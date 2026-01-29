
const selfsigned = require('selfsigned');

console.log('Testing selfsigned generation...');

try {
    const attrs = [{ name: 'commonName', value: '192.168.1.113' }];
    // Try synchronous usage which is common for this lib
    const pems = selfsigned.generate(attrs, { days: 365 });
    console.log('Synchronous generation successful!');
    console.log('Private Key length:', pems.private.length);
    console.log('Cert length:', pems.cert.length);
} catch (e) {
    console.log('Synchronous generation failed:', e.message);
}

try {
    const attrs = [{ name: 'commonName', value: '192.168.1.113' }];
    // Try promise usage just in case
    const pemsPromise = selfsigned.generate(attrs, { days: 365 });
    if (pemsPromise instanceof Promise) {
        pemsPromise.then(pems => {
            console.log('Promise generation successful!');
            console.log('Private Key length:', pems.private.length);
            console.log('Cert length:', pems.cert.length);
        }).catch(err => {
            console.log('Promise generation failed:', err.message);
        });
    } else {
        console.log('Result is not a promise.');
    }
} catch (e) {
    console.log('Promise check failed (not a promise context):', e.message);
}
