// The app's name and web addresses come from brand.json, so they can be changed in one place.
import brand from '../brand.json';
export const APP_NAME: string = brand.name;
const site = brand.siteUrl.replace(/\/+$/, '');
export const LINKS = { support: `${site}/support.html`, privacy: `${site}/privacy.html`, terms: `${site}/terms.html` };
