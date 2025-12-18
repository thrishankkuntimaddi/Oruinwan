// Debug helper for ChannelsPanel
// Add this temporarily to ChannelsPanel.jsx to debug channel data

useEffect(() => {
    if (channels.length > 0) {
        console.log('\n🔍 CHANNEL DEBUG INFO\n');
        console.log('Current Workspace ID:', workspaceId);
        console.log('Channels loaded:', channels.length);
        console.log('\nChannel Details:');

        channels.forEach((ch, idx) => {
            console.log(`\n${idx + 1}. #${ch.label}`);
            console.log(`   ID: ${ch.id}`);
            console.log(`   Type: ${ch.type}`);
            console.log(`   Default: ${ch.isDefault}`);
            console.log(`   Private: ${ch.isPrivate}`);
            console.log(`   Path: ${ch.path}`);
        });

        // Check for duplicates
        const names = channels.map(ch => ch.label);
        const duplicates = names.filter((name, idx) => names.indexOf(name) !== idx);

        if (duplicates.length > 0) {
            console.warn('\n⚠️ DUPLICATE CHANNEL NAMES DETECTED:', duplicates);
            console.warn('This indicates old test data in the database.');
            console.warn('Solution: Run cleanup script or clear database.');
        } else {
            console.log('\n✅ No duplicate channels detected!');
        }
    }
}, [channels, workspaceId]);
