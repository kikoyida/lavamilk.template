/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  app.save(new Collection({
    name: 'pig_scores', type: 'base',
    listRule: null, viewRule: null, createRule: null, updateRule: null, deleteRule: null,
    fields: [
      { name: 'repo', type: 'text', required: true, max: 150 },
      { name: 'score', type: 'number', min: 0, max: 100 },
      { name: 'eligible', type: 'number', min: 0, max: 100 },
      { name: 'version', type: 'number' },
      { name: 'scannedAt', type: 'number' },
      { name: 'report', type: 'json', maxSize: 20000 },
    ],
    indexes: ['CREATE UNIQUE INDEX idx_pig_repo ON pig_scores (repo)'],
  }));
  const settings = app.settings();
  settings.rateLimits.enabled = true;
  settings.rateLimits.rules.push({ label: 'POST /api/pig-king/scan', audience: '', duration: 60, maxRequests: 6 });
  app.save(settings);
}, (app) => {
  app.delete(app.findCollectionByNameOrId('pig_scores'));
  const settings = app.settings();
  settings.rateLimits.rules = settings.rateLimits.rules.filter((r) => r.label !== 'POST /api/pig-king/scan');
  app.save(settings);
});
