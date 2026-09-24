/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  app.save(new Collection({
    name: 'pig_accounts', type: 'base',
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: 'account', type: 'text', required: true, max: 39 },
      { name: 'score', type: 'number', min: 0, max: 100 },
      { name: 'eligible', type: 'number', min: 0, max: 100 },
      { name: 'completedAt', type: 'number' },
      { name: 'lockedUntil', type: 'number' },
      { name: 'failure', type: 'text', max: 40 },
      { name: 'job', type: 'json', maxSize: 5000000 },
      { name: 'report', type: 'json', maxSize: 5000000 },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_pig_account ON pig_accounts (account)'],
  }));
  const settings = app.settings();
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules.push({ label: 'POST /api/pig-king/account-scan', audience: '', duration: 60, maxRequests: 30 });
  app.save(settings);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('pig_accounts'));
  const settings = app.settings();
  settings.rateLimits.rules = settings.rateLimits.rules.filter(r => r.label !== 'POST /api/pig-king/account-scan');
  app.save(settings);
});
