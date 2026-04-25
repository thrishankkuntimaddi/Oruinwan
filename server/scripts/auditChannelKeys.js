#!/usr/bin/env node

const mongoose = require('mongoose');
require('dotenv').config();

const Channel = require("../src/features/channels/channel.model.js");
const ConversationKey = require('../models/ConversationKey');

async function auditChannelKeys() {
    try {
        
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to database');

        
        const channels = await Channel.find({}).lean();
        console.log(`📊 Found ${channels.length} channels total`);

        const violations = [];
        const compliant = [];
        let legacyChannels = 0;

        for (const channel of channels) {
            
            const conversationKey = await ConversationKey.findOne({
                conversationId: channel._id,
                conversationType: 'channel'
            });

            if (!conversationKey) {
                
                const PHASE_5_START_DATE = new Date('2026-01-25'); 
                const isLegacy = new Date(channel.createdAt) < PHASE_5_START_DATE;

                if (isLegacy) {
                    legacyChannels++;
                } else {
                    
                    violations.push({
                        channelId: channel._id.toString(),
                        channelName: channel.name,
                        workspace: channel.workspace.toString(),
                        createdAt: channel.createdAt,
                        isDefault: channel.isDefault,
                        memberCount: channel.members ? channel.members.length : 0
                    });
                }
            } else {
                compliant.push({
                    channelId: channel._id.toString(),
                    channelName: channel.name,
                    keyParticipants: conversationKey.encryptedKeys.length
                });
            }
        }

        
        console.log('\n' + '='.repeat(80));
        console.log('📋 PHASE 5 INVARIANT AUDIT REPORT');
        console.log('='.repeat(80));
        console.log(`✅ Compliant channels: ${compliant.length}`);
        console.log(`⚠️  Legacy channels (pre-Phase 5): ${legacyChannels}`);
        console.log(`🚨 VIOLATIONS (post-Phase 5 channels without keys): ${violations.length}`);
        console.log('='.repeat(80));

        if (violations.length > 0) {
            console.error('\n🚨 CRITICAL: Found Phase 5 invariant violations!\n');
            console.table(violations);
            console.error('\n⚠️  Action Required:');
            console.error('1. Review channel creation code for missing Phase 5 logic');
            console.error('2. Manually bootstrap keys for these channels');
            console.error('3. Verify all channel creation paths call generateConversationKeyServerSide() or bootstrapConversationKey()');
        } else {
            console.log('\n✅ SUCCESS: All post-Phase 5 channels have conversation keys');
            console.log('   Phase 5 invariant is intact!\n');

            if (legacyChannels > 0) {
                console.log(`ℹ️  Note: ${legacyChannels} legacy channels exist without keys (expected for pre-Phase 5 channels)`);
            }
        }

        
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from database');

        
        process.exit(violations.length > 0 ? 1 : 0);

    } catch (error) {
        console.error('❌ Audit failed:', error);
        await mongoose.disconnect();
        process.exit(1);
    }
}

auditChannelKeys();
