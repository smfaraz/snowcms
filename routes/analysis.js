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

    // 1. Fetch data from key system tables
    // We limit results to active ones to focus on current instance state
    const query = 'sysparm_query=active=true^ORDERBYcollection';
    
    const [businessRules, uiPolicies, clientScripts, scriptIncludes] = await Promise.all([
      snFetch('sys_script', `${query}&sysparm_fields=sys_id,name,collection,order,when,action_insert,action_update,action_delete,condition,script`),
      snFetch('sys_ui_policy', `${query}&sysparm_fields=sys_id,short_description,table,order,conditions,script_true,script_false`),
      snFetch('sys_script_client', `${query}&sysparm_fields=sys_id,name,table,order,type,view,script`),
      snFetch('sys_script_include', `active=true^sysparm_fields=sys_id,name,script,api_name,access`),
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
    Object.keys(brByTable).forEach(table => {
      const rules = brByTable[table];
      const orderMap = {};
      
      rules.forEach(rule => {
        const key = `${rule.when}_${rule.order}`;
        if (!orderMap[key]) orderMap[key] = [];
        orderMap[key].push(rule);
      });

      Object.keys(orderMap).forEach(key => {
        if (orderMap[key].length > 1) {
          conflicts.push({
            type: 'Constraint Conflict',
            severity: 'High',
            table,
            description: {
              dev: `Multiple Business Rules (${orderMap[key].length}) running "${key.split('_')[0]}" with same order (${key.split('_')[1]}). Execution order is non-deterministic, risking race conditions and unpredictable state changes.`,
              plain: `Multiple automated rules (${orderMap[key].length}) are trying to run at the exact same time. The system doesn't know which one to run first, which means they might accidentally overwrite each other's work.`
            },
            impactUnresolved: 'Data might be saved incorrectly or inconsistently because the rules will run in a random order every time. This can cause confusing bugs that are hard to track down.',
            impactResolved: 'The system will run the rules in a predictable, consistent order, ensuring your data is always accurate and reliable.',
            items: orderMap[key].map(r => r.name)
          });
        }
      });
    });

    // 3. Analyze UI Policy Overlaps
    Object.keys(upByTable).forEach(table => {
      const policies = upByTable[table];
      if (policies.length > 5) {
        conflicts.push({
          type: 'Potential Performance Issue',
          severity: 'Low',
          table,
          description: {
            dev: `High density of UI Policies (${policies.length}) on a single table. Evaluating many client-side conditions can block the main thread and impact TTI (Time to Interactive).`,
            plain: `There are too many rules (${policies.length}) controlling how the screen looks (like showing/hiding fields). This puts a heavy load on the user's browser.`
          },
          impactUnresolved: 'The screen will load slowly for users, and the app might feel sluggish or unresponsive when they click around or fill out forms.',
          impactResolved: 'Forms will load quickly, giving users a snappy, seamless experience without freezing or lagging.',
          items: policies.map(p => p.short_description || p.sys_id)
        });
      }
    });

    // 4. Client Script Overlaps
    Object.keys(csByTable).forEach(table => {
      const scripts = csByTable[table];
      const onChangeScripts = scripts.filter(s => s.type === 'onChange');
      if (onChangeScripts.length > 3) {
         conflicts.push({
          type: 'Scripting Complexity',
          severity: 'Medium',
          table,
          description: {
            dev: `High density of onChange Client Scripts (${onChangeScripts.length}). This introduces a high risk of recursive DOM updates, variable collision, and unexpected cascade events.`,
            plain: `There are many scripts (${onChangeScripts.length}) set to run automatically every time a user types or selects something on the screen. Too many of these can trigger a chain reaction.`
          },
          impactUnresolved: 'Users might experience the page freezing, crashing, or unexpected things happening on their screen (like fields clearing themselves) while typing.',
          impactResolved: 'The screen will respond smoothly to user input without unexpected glitches or browser crashes.',
          items: onChangeScripts.map(s => s.name)
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

module.exports = router;
