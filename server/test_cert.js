const selfsigned = require('selfsigned');

console.log('Library Type:', typeof selfsigned);
console.log('Generate Type:', typeof selfsigned.generate);

try {
    const attrs = [{ name: 'commonName', value: '192.168.1.113' }];
    console.log('Calling generate()...');
    const result = selfsigned.generate(attrs, { days: 365 });

    console.log('Result Type:', typeof result);
    console.log('Result Keys:', result ? Object.keys(result) : 'null');

    if (result instanceof Promise) {
        console.log('Result is a Promise! Awaiting...');
        result.then(res => {
            console.log('Resolved Keys:', Object.keys(res));
            console.log('Private Key found?', !!res.private);
        }).catch(err => console.error('Promise Error:', err));
    } else {
        console.log('Private Key found?', result && !!result.private);
    }
} catch (error) {
    console.error('Execution Error:', error);
}
