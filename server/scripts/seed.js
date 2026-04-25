require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const Company = require('./models/Company');
const Workspace = require('./models/Workspace');

const seedData = async () => {
    try {
        
        const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/chttrix';
        await mongoose.connect(mongoUri);
        console.log('✅ MongoDB Connected');

        
        console.log('🗑️  Clearing existing data...');
        await User.deleteMany({});
        await Company.deleteMany({});
        await Workspace.deleteMany({});
        console.log('✅ Data cleared');

        
        console.log('🏢 Creating company...');
        const company = await Company.create({
            name: 'Chttrix Technologies',
            domain: 'chttrix.com',
            isActive: true,
            domainVerified: true,
            autoJoinByDomain: true,
            allowedEmails: ['admin@chttrix.com', 'employee@chttrix.com'],
            settings: {
                allowSelfRegistration: true,
                requireEmailVerification: false, 
                defaultUserRole: 'member',
            }
        });
        console.log(`✅ Company created: ${company.name} (${company._id})`);

        
        console.log('👤 Creating admin user...');
        const adminPassword = await bcrypt.hash('admin123', 12);
        const adminUser = await User.create({
            username: 'Admin User',
            email: 'admin@chttrix.com',
            passwordHash: adminPassword,
            verified: true,
            userType: 'company',
            companyId: company._id,
            companyRole: 'owner', 
            workspaces: [], 
            profile: {
                name: 'Admin User',
                jobTitle: 'System Administrator',
            }
        });
        console.log(`✅ Admin user created: ${adminUser.email}`);
        console.log(`   📧 Email: admin@chttrix.com`);
        console.log(`   🔑 Password: admin123`);
        console.log(`   👑 Role: ${adminUser.companyRole}`);

        
        console.log('🏗️  Creating default workspace...');
        const workspace = await Workspace.create({
            name: 'General',
            description: 'Default workspace for all team members',
            company: company._id,
            type: 'company',
            icon: '🏢',
            createdBy: adminUser._id, 
            members: [{
                user: adminUser._id,
                role: 'owner',
                joinedAt: new Date()
            }],
        });
        console.log(`✅ Workspace created: ${workspace.name} (${workspace._id})`);

        
        company.defaultWorkspace = workspace._id;
        await company.save();

        
        adminUser.workspaces.push({
            workspace: workspace._id,
            role: 'owner',
            joinedAt: new Date(),
        });
        await adminUser.save();

        
        console.log('👤 Creating regular employee...');
        const employeePassword = await bcrypt.hash('employee123', 12);
        const employeeUser = await User.create({
            username: 'John Employee',
            email: 'employee@chttrix.com',
            passwordHash: employeePassword,
            verified: true,
            userType: 'company',
            companyId: company._id,
            companyRole: 'member', 
            workspaces: [{
                workspace: workspace._id,
                role: 'member',
                joinedAt: new Date(),
            }],
            profile: {
                name: 'John Employee',
                jobTitle: 'Software Engineer',
            }
        });
        console.log(`✅ Employee created: ${employeeUser.email}`);
        console.log(`   📧 Email: employee@chttrix.com`);
        console.log(`   🔑 Password: employee123`);
        console.log(`   👤 Role: ${employeeUser.companyRole}`);

        
        console.log('👤 Creating another admin...');
        const admin2Password = await bcrypt.hash('admin456', 12);
        const admin2User = await User.create({
            username: 'Jane Admin',
            email: 'jane@chttrix.com',
            passwordHash: admin2Password,
            verified: true,
            userType: 'company',
            companyId: company._id,
            companyRole: 'admin', 
            workspaces: [{
                workspace: workspace._id,
                role: 'admin',
                joinedAt: new Date(),
            }],
            profile: {
                name: 'Jane Admin',
                jobTitle: 'Team Lead',
            }
        });
        console.log(`✅ Admin created: ${admin2User.email}`);
        console.log(`   📧 Email: jane@chttrix.com`);
        console.log(`   🔑 Password: admin456`);
        console.log(`   👤 Role: ${admin2User.companyRole}`);

        
        workspace.members.push(
            { user: admin2User._id, role: 'admin', joinedAt: new Date() },
            { user: employeeUser._id, role: 'member', joinedAt: new Date() }
        );
        await workspace.save();
        console.log(`✅ Workspace members updated`);

        
        console.log('\n' + '='.repeat(60));
        console.log('🎉 DATABASE SEEDED SUCCESSFULLY!');
        console.log('='.repeat(60));
        console.log('\n📊 Created:');
        console.log(`   • 1 Company: ${company.name}`);
        console.log(`   • 1 Workspace: ${workspace.name}`);
        console.log(`   • 3 Users (1 owner, 1 admin, 1 employee)`);

        console.log('\n🔐 Login Credentials:');
        console.log('\n   👑 OWNER (Full Admin Access):');
        console.log(`      Email: admin@chttrix.com`);
        console.log(`      Password: admin123`);
        console.log(`      Can access: /admin/company ✅`);

        console.log('\n   🛡️  ADMIN (Admin Access):');
        console.log(`      Email: jane@chttrix.com`);
        console.log(`      Password: admin456`);
        console.log(`      Can access: /admin/company ✅`);

        console.log('\n   👤 EMPLOYEE (Regular User):');
        console.log(`      Email: employee@chttrix.com`);
        console.log(`      Password: employee123`);
        console.log(`      Can access: /admin/company ❌ (Will be redirected)`);

        console.log('\n🚀 Next Steps:');
        console.log('   1. Start server: npm start');
        console.log('   2. Start client: cd client && npm start');
        console.log('   3. Login with admin@chttrix.com / admin123');
        console.log('   4. Visit: http://localhost:3000/admin/company');
        console.log('='.repeat(60) + '\n');

        process.exit(0);
    } catch (err) {
        console.error('❌ Seed Error:', err);
        process.exit(1);
    }
};

seedData();
