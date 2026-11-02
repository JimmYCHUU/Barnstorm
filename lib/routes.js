// Registers the API routes added by later parts of the engine (plan, publish, learn, settings, feed).
// Each module calls route(...) from api.js when imported.
import './plan-routes.js';
import './publish-routes.js';
import './settings-routes.js';
import './feed-routes.js';
