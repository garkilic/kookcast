const fetch = require('node-fetch');

// Function to simulate tomorrow's behavior
async function testTomorrowBehavior() {
    try {
        // 1. First check - should see if multiple requests try to run
        console.log('\n=== Test 1: Multiple Concurrent Requests ===');
        const promises = [];
        for (let i = 0; i < 3; i++) {
            promises.push(
                fetch('https://api-ovbmv2dgfq-uc.a.run.app/trigger-scheduled', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        simulate_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                    })
                }).then(res => res.json())
            );
        }

        const results = await Promise.all(promises);
        console.log('Concurrent request results:', results);

        // 2. Check lock status after concurrent requests
        console.log('\n=== Test 2: Check Lock Status ===');
        const lockStatus = await fetch('https://api-ovbmv2dgfq-uc.a.run.app/check-lock')
            .then(res => res.json());
        console.log('Lock status after concurrent requests:', lockStatus);

    } catch (error) {
        console.error('Test failed:', error);
    }
}

// Run the test
console.log('Starting tomorrow simulation test...');
testTomorrowBehavior()
    .then(() => console.log('\nTest completed'))
    .catch(error => console.error('\nTest failed:', error)); 