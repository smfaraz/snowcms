const express = require('express');
const router = express.Router();
require('dotenv').config();

router.post('/conflicts', async (req, res, next) => {
  try {
    const SN_BASE_URL = req.body.url || process.env.SN_INSTANCE_URL;
    const SN_USERNAME = req.body.username || process.env.SN_USERNAME;
    const SN_PASSWORD = req.body.password || process.env.SN_PASSWORD;

    if (!SN_BASE_URL || !SN_USERNAME || !SN_PASSWORD) {
      return res.status(400).json({ error: 'Instance URL, username, and password are required.' });
    }

    const basicAuth = Buffer.from(`${SN_USERNAME}:${SN_PASSWORD}`).toString('base64');

    async function snFetch(table, query = '') {
      const url = `${SN_BASE_URL}/api/now/table/${table}?${query}`;
      const apiRes = await fetch(url, {
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });

      if (!apiRes.ok) {
        const text = await apiRes.text();
        throw new Error(`ServiceNow error: ${apiRes.status} - ${text}`);
      }

      const contentType = apiRes.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const text = await apiRes.text();
        throw new Error(`ServiceNow returned an HTML page (possibly a login/SSO redirect or hibernating instance) instead of JSON: ${text.substring(0, 200)}...`);
      }

      const data = await apiRes.json();
      return data.result || [];
    }

    // Helper to strip JS comments from a script string to prevent false positives in regex
    const stripComments = (str) => {
      if (!str) return '';
      return str.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');
    };

    // 1. Fetch data from key system tables
    // We limit results to active ones and filter out untouched built-in (OOB) records using sys_customer_update=true
    const query = 'sysparm_query=active=true^sys_customer_update=true^ORDERBYcollection';
    
    const [businessRules, uiPolicies, clientScripts, scriptIncludes] = await Promise.all([
      snFetch('sys_script', `${query}&sysparm_fields=sys_id,name,collection,order,when,action_insert,action_update,action_delete,condition,script`),
      snFetch('sys_ui_policy', `${query}&sysparm_fields=sys_id,short_description,table,order,conditions,script_true,script_false`),
      snFetch('sys_script_client', `${query}&sysparm_fields=sys_id,name,table,order,type,view,script,fieldname`),
      snFetch('sys_script_include', `sysparm_query=active=true^sys_customer_update=true&sysparm_fields=sys_id,name,script,api_name,access`),
    ]);

    const conflicts = [];
    
    // Helper to group by table
    const groupByTable = (items, tableField) => {
      return items.reduce((acc, item) => {
        const table = item[tableField] || 'global';
        if (!acc[table]) acc[table] = [];
        acc[table].push(item);
        return acc;
      }, {});
    };

    const brByTable = groupByTable(businessRules, 'collection');
    const upByTable = groupByTable(uiPolicies, 'table');
    const csByTable = groupByTable(clientScripts, 'table');

    // 2. Analyze Business Rules Conflicts
    // The user requested to ignore ALL "same order" business rule conflicts as they are considered false positives.
    // We keep brByTable for the JSON response but skip generating Constraint Conflicts based on order.

    // 3. Analyze UI Policy Overlaps (Industry Grade: Identical Conditions)
    Object.keys(upByTable).forEach(table => {
      const policies = upByTable[table];
      const conditionMap = {};
      
      policies.forEach(p => {
        if (!p.conditions) return; // Skip policies without conditions
        if (!conditionMap[p.conditions]) conditionMap[p.conditions] = [];
        conditionMap[p.conditions].push(p);
      });

      Object.keys(conditionMap).forEach(cond => {
        if (conditionMap[cond].length > 1) {
          conflicts.push({
            type: 'Redundant UI Policies',
            severity: 'Medium',
            table,
            description: {
              dev: `Multiple UI Policies (${conditionMap[cond].length}) share the exact same trigger condition: "${cond}". This leads to redundant evaluation cycles and potential client-side race conditions if scripts contradict each other.`,
              plain: `Multiple screen rules (${conditionMap[cond].length}) are waiting for the exact same thing to happen. This is inefficient and can cause them to fight over who gets to change the screen.`
            },
            impactUnresolved: 'The browser has to do extra work evaluating the same rules repeatedly. If their actions conflict, the screen might flicker or show the wrong fields.',
            impactResolved: 'Consolidating these into a single UI Policy with multiple actions improves form load time and makes it easier for developers to maintain.',
            items: conditionMap[cond].map(p => ({ sys_id: p.sys_id, name: p.short_description || p.sys_id, table: 'sys_ui_policy', script: p.script_true }))
          });
        }
      });
    });

    // 4. Client Script Overlaps (Industry Grade: Multiple onChange scripts on the exact same field)
    Object.keys(csByTable).forEach(table => {
      const scripts = csByTable[table];
      const fieldMap = {};
      
      scripts.filter(s => s.type === 'onChange').forEach(s => {
        const field = s.fieldname || 'unknown';
        if (field === 'unknown') return;
        if (!fieldMap[field]) fieldMap[field] = [];
        fieldMap[field].push(s);
      });

      Object.keys(fieldMap).forEach(field => {
        if (fieldMap[field].length > 1) {
           conflicts.push({
            type: 'onChange Event Collision',
            severity: 'High',
            table,
            description: {
              dev: `Multiple onChange Client Scripts (${fieldMap[field].length}) are listening to the exact same field: "${field}". Execution order is not guaranteed, which can lead to data loss or variable collision.`,
              plain: `Multiple scripts are trying to react at the same time when the "${field}" field changes. Because they don't take turns, one script might accidentally erase what the other script just did.`
            },
            impactUnresolved: 'When users change this field, the form might behave unpredictably, overwrite data, or freeze the browser in a loop.',
            impactResolved: 'Merging these scripts ensures they run in a strict, predictable order, preventing unpredictable form glitches.',
            items: fieldMap[field].map(s => ({ sys_id: s.sys_id, name: s.name, table: 'sys_script_client', script: s.script }))
          });
        }
      });
    });

    // 5. Deep Static Analysis for Scripts (Best Practices)
    businessRules.forEach(rule => {
      const scriptStr = stripComments(rule.script); // Strip comments to prevent false positives
      
      // Check for current.update() recursive risk in before/display/query rules
      if (['before', 'display', 'query'].includes(rule.when) && /\bcurrent\s*\.\s*update\s*\(\s*\)/.test(scriptStr)) {
        conflicts.push({
          type: 'Infinite Loop Risk',
          severity: 'High',
          table: rule.collection || 'global',
          description: {
            dev: `Business Rule "${rule.name}" executes "current.update()" in a "${rule.when}" context. This re-triggers business rules recursively, risking stack overflows or massive server overhead.`,
            plain: `Rule "${rule.name}" tries to save a record while it is already in the middle of a save process. This can trap the system in an endless loop.`
          },
          impactUnresolved: 'Users will experience long saving delays, and the instance may crash during high transaction loads.',
          impactResolved: 'Eliminating current.update() allows the save operation to complete in a single pass, saving server processing power.',
          items: [{ sys_id: rule.sys_id, name: rule.name, table: 'sys_script', script: rule.script }]
        });
      }
      
      // Check for hardcoded sys_ids
      const sysIdRegex = /['"][0-9a-fA-F]{32}['"]/g;
      if (sysIdRegex.test(scriptStr)) {
        conflicts.push({
          type: 'Maintainability Issue',
          severity: 'Low',
          table: rule.collection || 'global',
          description: {
            dev: `Business Rule "${rule.name}" contains hardcoded sys_id values. Hardcoding sys_ids is a major anti-pattern that breaks migrations across DEV/TEST/PROD instances.`,
            plain: `Rule "${rule.name}" contains a "hidden ID" pointing to a specific database entry. Moving this to another environment will break it if the ID doesn't match perfectly.`
          },
          impactUnresolved: 'Code migrations will silently fail in production, requiring manual data-reconciliation tasks.',
          impactResolved: 'Replacing hardcoded IDs with system properties or lookups makes the code portable across all environments.',
          items: [{ sys_id: rule.sys_id, name: rule.name, table: 'sys_script', script: rule.script }]
        });
      }

      // Check for un-scoped GlideRecord querying without limits
      if (/\bnew\s+GlideRecord\s*\(['"][^'"]+['"]\)/.test(scriptStr) && !/\.setLimit\s*\(/.test(scriptStr) && !/\.get\s*\(/.test(scriptStr)) {
        // We look for while(gr.next()) or if(gr.next())
        if (/\bwhile\s*\(\s*[a-zA-Z0-9_]+\.next\s*\(\s*\)\s*\)/.test(scriptStr)) {
           // We might flag unoptimized bulk queries, but to avoid false positives on legitimate bulk processing, we'll keep it simple or skip it.
           // Actually, let's look for GlideRecord queries running inside loops.
           if (/while\s*\([^)]+\)\s*\{[^}]*new\s+GlideRecord/.test(scriptStr) || /for\s*\([^)]+\)\s*\{[^}]*new\s+GlideRecord/.test(scriptStr)) {
             conflicts.push({
                type: 'N+1 Query Anti-pattern',
                severity: 'High',
                table: rule.collection || 'global',
                description: {
                  dev: `Business Rule "${rule.name}" instantiates a GlideRecord inside a loop. This leads to the N+1 query problem, severely degrading database performance.`,
                  plain: `Rule "${rule.name}" is making separate database requests inside a repeating loop. If the loop runs 100 times, it hammers the database 100 times instead of just once.`
                },
                impactUnresolved: 'Operations affecting multiple records will take exponentially longer to complete, eventually timing out.',
                impactResolved: 'Batching the queries using the "IN" operator outside the loop minimizes database roundtrips and speeds up execution significantly.',
                items: [{ sys_id: rule.sys_id, name: rule.name, table: 'sys_script', script: rule.script }]
              });
           }
        }
      }
    });

    // Check Client Scripts for synchronous GlideRecord
    clientScripts.forEach(script => {
      const scriptStr = stripComments(script.script);
      // Look for synchronous GlideRecord instantiation without a callback
      if (/\bnew\s+GlideRecord\s*\(/.test(scriptStr)) {
        conflicts.push({
          type: 'Performance Anti-pattern',
          severity: 'High',
          table: script.table || 'global',
          description: {
            dev: `Client Script "${script.name}" uses synchronous GlideRecord calls on the client side. This blocks the main UI thread and prevents the user from interacting with the form.`,
            plain: `Client Script "${script.name}" talks directly to the database from the browser. This freezes the screen entirely until the database replies.`
          },
          impactUnresolved: 'Users will experience frustrating lag and frozen web browsers every time they open or interact with this form.',
          impactResolved: 'Migrating to asynchronous GlideAjax keeps the UI thread unblocked, making the form feel snappy and instantly responsive.',
          items: [{ sys_id: script.sys_id, name: script.name, table: 'sys_script_client', script: script.script }]
        });
      }
    });

    res.json({
      success: true,
      stats: {
        businessRules: businessRules.length,
        uiPolicies: uiPolicies.length,
        clientScripts: clientScripts.length,
        scriptIncludes: scriptIncludes.length
      },
      conflicts,
      scriptIncludes, // Needed for references in other scripts
      brByTable,
      upByTable,
      csByTable
    });
  } catch (err) {
    next(err);
  }
});

// Replaced with frontend execution

router.post('/test-connection', async (req, res, next) => {
  try {
    const SN_BASE_URL = req.body.url;
    const SN_USERNAME = req.body.username;
    const SN_PASSWORD = req.body.password;

    if (!SN_BASE_URL || !SN_USERNAME || !SN_PASSWORD) {
      return res.status(400).json({ error: 'Instance URL, username, and password are required.' });
    }

    const basicAuth = Buffer.from(`${SN_USERNAME}:${SN_PASSWORD}`).toString('base64');
    const url = `${SN_BASE_URL}/api/now/table/sys_user?sysparm_limit=1`;
    
    const apiRes = await fetch(url, {
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    if (!apiRes.ok) {
      const text = await apiRes.text();
      return res.status(apiRes.status).json({ error: `ServiceNow error: ${apiRes.status} - ${text}` });
    }

    const contentType = apiRes.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return res.status(403).json({ error: 'ServiceNow returned an HTML page. Ensure your instance is online (not hibernating) and credentials are correct.' });
    }

    res.json({ success: true, message: 'Connected successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deploy-fix', async (req, res, next) => {
  try {
    const SN_BASE_URL = req.body.url;
    const SN_USERNAME = req.body.username;
    const SN_PASSWORD = req.body.password;
    
    const { targetTable, sysId, updateFields } = req.body;
    
    if (!SN_BASE_URL || !SN_USERNAME || !SN_PASSWORD || !targetTable || !sysId || !updateFields) {
      return res.status(400).json({ error: 'Missing required deployment parameters (URL, auth, table, sysId, or fields).' });
    }
    
    const basicAuth = Buffer.from(`${SN_USERNAME}:${SN_PASSWORD}`).toString('base64');
    const url = `${SN_BASE_URL}/api/now/table/${targetTable}/${sysId}`;
    
    const apiRes = await fetch(url, {
      method: 'PUT', 
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(updateFields)
    });
    
    if (!apiRes.ok) {
      const text = await apiRes.text();
      return res.status(apiRes.status).json({ error: `ServiceNow error: ${apiRes.status} - ${text}` });
    }
    
    const contentType = apiRes.headers.get('content-type') || '';
    if (contentType.includes('text/html')) {
      return res.status(403).json({ error: 'ServiceNow returned HTML during deployment. Instance may be asleep.' });
    }
    
    const result = await apiRes.json();
    res.json({ success: true, message: 'Successfully deployed fix to ServiceNow!', result: result.result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
