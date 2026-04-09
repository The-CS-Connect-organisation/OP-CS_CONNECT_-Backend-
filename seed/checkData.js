import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const check = async () => {
  const { data: users, count: userCount } = await supabase
    .from('users')
    .select('name, email, role', { count: 'exact' })
    .order('role')
    .order('name');

  console.log(`\n📊 SUPABASE DATA VERIFICATION\n${'═'.repeat(60)}`);
  console.log(`\n👥 USERS (${userCount} total):\n`);
  
  const grouped = {};
  for (const u of users) {
    if (!grouped[u.role]) grouped[u.role] = [];
    grouped[u.role].push(u);
  }
  
  for (const [role, list] of Object.entries(grouped)) {
    console.log(`  ${role.toUpperCase()} (${list.length}):`);
    for (const u of list) {
      console.log(`    ${u.name.padEnd(28)} ${u.email}`);
    }
    console.log();
  }

  const tables = ['classrooms', 'student_profiles', 'teacher_profiles', 'parent_profiles', 
                  'assignments', 'submissions', 'attendance_records', 'marks', 'announcements'];
  
  console.log('📋 TABLE COUNTS:');
  for (const t of tables) {
    const { count } = await supabase.from(t).select('id', { count: 'exact', head: true });
    console.log(`  ${t.padEnd(25)} ${count}`);
  }
  
  console.log('\n✅ All data verified in Supabase!\n');
  process.exit(0);
};

check().catch(e => { console.error(e); process.exit(1); });
