
const login = async (email, password) => {
    console.log(`Attempting login for ${email}...`);
    try {
        const response = await fetch('http://localhost:4000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const text = await response.text();
        console.log(`Response Status: ${response.status}`);
        console.log(`Response Body: ${text}`);

        try {
            return JSON.parse(text);
        } catch (e) {
            return {};
        }
    } catch (e) {
        console.error('Fetch Error:', e);
        return {};
    }
};

const getPlayers = async (token) => {
    const response = await fetch('http://localhost:4000/api/guardian/players', {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    return response.json();
};

const bookSession = async (token, coachId, playerIds) => {
    // Tomorrow at 10 AM
    const startTime = new Date();
    startTime.setDate(startTime.getDate() + 1);
    startTime.setHours(10, 0, 0, 0);

    const payload = {
        coachId,
        startTime: startTime.toISOString(),
        durationMinutes: 60,
        paymentMethod: 'card',
        playerIds
    };

    console.log('Sending Booking Payload:', JSON.stringify(payload, null, 2));

    const response = await fetch('http://localhost:4000/api/bookings/private', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    const text = await response.text();
    try {
        return { status: response.status, body: JSON.parse(text) };
    } catch (e) {
        return { status: response.status, body: text };
    }
};

const run = async () => {
    try {
        console.log('--- 1. Login as Coach (Sarah) ---');
        const coachAuth = await login('sarah.coach@cricketapp.com', 'password123');
        if (!coachAuth.token) throw new Error('Coach login failed');
        const coachId = coachAuth.user._id;
        console.log('Coach ID (User ID):', coachId);

        console.log('\n--- 2. Login as Guardian (David) ---');
        const guardianAuth = await login('david.parent@cricketapp.com', 'password123');
        if (!guardianAuth.token) throw new Error('Guardian login failed');
        console.log('Guardian Logged In');

        console.log('\n--- 3. Get Guardian Players ---');
        const playersData = await getPlayers(guardianAuth.token);
        const players = playersData.data || [];
        if (players.length === 0) throw new Error('No players found for guardian');
        console.log(`Found ${players.length} players`);
        const playerIds = players.map(p => p._id);
        console.log('Player IDs:', playerIds);

        console.log('\n--- 4. Book Private Session ---');
        const bookingResult = await bookSession(guardianAuth.token, coachId, playerIds); // Book for all players
        console.log('Booking Result Status:', bookingResult.status);
        console.log('Booking Result Body:', JSON.stringify(bookingResult.body, null, 2));

    } catch (error) {
        console.error('Error:', error);
    }
};

run();
