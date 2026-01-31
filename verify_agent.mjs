
async function verify() {
    const BASE_URL = 'http://localhost:5174';
    const AGENT_NAME = 'auto-test-agent-' + Date.now();

    console.log(`Creating agent: ${AGENT_NAME}...`);
    try {
        const createRes = await fetch(`${BASE_URL}/api/registry`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-partykit-room': 'default'
            },
            body: JSON.stringify({ name: AGENT_NAME })
        });

        if (!createRes.ok) throw new Error(`Create failed: ${createRes.status} ${await createRes.text()}`);
        console.log('Agent created successfully.');

        console.log('Sending chat command...');
        const chatRes = await fetch(`${BASE_URL}/api/chat/${AGENT_NAME}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // Chat DO likely has its own ID based on name, so room header might be 'AGENT_NAME' or ignored if routed by ID
            },
            body: JSON.stringify({
                messages: [{ role: 'user', content: 'Hello' }]
            })
        });

        if (!chatRes.ok) throw new Error(`Chat failed: ${chatRes.status} ${await chatRes.text()}`);

        console.log('Reading response...');
        const reader = chatRes.body.getReader();
        const decoder = new TextDecoder();
        let result = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            result += chunk;
            process.stdout.write(chunk);
        }
        console.log('\nChat completed.');

        if (result.length > 0) {
            console.log("VERIFICATION SUCCESS: Agent responded.");
        } else {
            console.log("VERIFICATION FAILURE: Empty response.");
            process.exit(1);
        }

    } catch (error) {
        console.error('VERIFICATION FAILED:', error);
        process.exit(1);
    }
}

verify();
