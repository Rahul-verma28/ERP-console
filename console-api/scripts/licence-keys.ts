import { randomBytes } from 'node:crypto';
import { newLicenceKeys } from '@contracts/licenceSigning';

// Prints a new licence key pair and a provisioning key for .env. The private key stays here on the
// Console; each ERP gets the public key and the provisioning key. Keep the old pair while licences
// signed with it are still in use.
//   npm run licence:keys
const k = newLicenceKeys();
console.log(`LICENCE_PRIVATE_KEY=${k.privateKey}`);
console.log(`LICENCE_PUBLIC_KEY=${k.publicKey}`);
console.log(`PROVISION_KEY=${randomBytes(32).toString('base64url')}`);
