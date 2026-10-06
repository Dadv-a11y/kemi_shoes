# Envoi de SMS / WhatsApp

Les codes OTP passent par l'interface `SmsProvider` (`send(phone, message)`).
Le fournisseur est choisi par variable d'environnement :

| Variable | Valeurs | Défaut |
|---|---|---|
| `SMS_PROVIDER` | `none`, `console`, `memory` (+ fournisseurs ajoutés) | `console` en développement, `memory` en test, `none` en production |
| `WHATSAPP_PROVIDER` | idem (repli si l'envoi SMS échoue) | `none` |

- `console` affiche le message dans la console du backend : **développement uniquement**, refusé au démarrage en production.
- `none` désactive le canal. Si aucun canal n'est actif, `GET /auth/providers` renvoie `phone: false`,
  le frontend masque la connexion par téléphone et `POST /auth/otp/request` répond 503.

## Brancher un fournisseur

```js
// TwilioSmsProvider.js (exemple)
import { SmsProvider } from './SmsProvider.js';

export class TwilioSmsProvider extends SmsProvider {
  constructor({ accountSid, authToken, from }) { super(); Object.assign(this, { accountSid, authToken, from }); }
  get name() { return 'twilio'; }
  async send(phone, message) {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64')}` },
      body: new URLSearchParams({ To: phone, From: this.from, Body: message }),
    });
    if (!response.ok) throw new Error(`twilio_${response.status}`);
    return { provider: this.name, messageId: (await response.json()).sid };
  }
}
```

Puis, dans `sms.factory.js`, ajouter `twilio: () => new TwilioSmsProvider({ ... })` au registre, et
`'twilio'` à l'enum `SMS_PROVIDER` de `config/env.js` (avec ses identifiants). Rien d'autre à modifier.
