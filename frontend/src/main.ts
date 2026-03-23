import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

if (environment.production) {
  window.console.log = () => { /* Suppressed in prod */ };
  window.console.info = () => { /* Suppressed in prod */ };
  window.console.debug = () => { /* Suppressed in prod */ };
}

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
