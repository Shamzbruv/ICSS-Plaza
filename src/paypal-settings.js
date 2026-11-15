import {decrypt,encrypt} from './model.js';

export const paypalSettingsKey='billing.paypal.live.v1';

export function paypalSettings({db,key}) {
 return {
  async read() {
   const row=await db.one('SELECT value FROM metadata WHERE key=?',paypalSettingsKey);
   return row?decrypt(row.value,key):null;
  },
  async write(settings) {
   await db.run('INSERT INTO metadata(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    paypalSettingsKey,encrypt(settings,key));
  }
 };
}
