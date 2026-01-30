'use strict';

/**
 * Seed script for UI-LM Portal - optimized for analytics dashboard visualization.
 * Run: npm run seed:portal
 * Clears all seeded data first, then creates fresh entries (idempotent - no duplicates).
 * Data is tailored for Learning Analytics & Overall Analytics dashboards.
 */

const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');

const ENTRY_COUNT = 12;
const VIZ_ENTRY_COUNT = 15; // More entries for analytics-heavy content

function getFileData(fileName) {
  const filePath = path.join(__dirname, '..', 'data', 'uploads', fileName);
  if (!fs.existsSync(filePath)) return null;
  const size = fs.statSync(filePath).size;
  const ext = fileName.split('.').pop();
  return { filepath: filePath, originalFileName: fileName, size, mimetype: mime.lookup(ext) || '' };
}

async function uploadFile(fileData) {
  return strapi.plugin('upload').service('upload').upload({
    files: fileData,
    data: { fileInfo: { name: fileData.originalFileName } },
  });
}

async function getOrUploadImage(fileName) {
  try {
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, '');
    const existing = await strapi.db.query('plugin::upload.file').findOne({
      where: { name: nameWithoutExt },
    });
    if (existing) return existing;
    const fileData = getFileData(fileName);
    if (!fileData) return null;
    const result = await uploadFile(fileData);
    const uploaded = Array.isArray(result) ? result[0] : result;
    return uploaded || null;
  } catch (err) {
    console.warn(`[seed] Could not upload ${fileName}:`, err.message);
    return null;
  }
}

async function createDocument(uid, data) {
  try {
    const doc = await strapi.documents(uid).create({
      data: { ...data, publishedAt: new Date() },
      status: 'published',
    });
    const id = doc?.documentId ?? doc?.id;
    return id ? { documentId: id, ...doc } : null;
  } catch (err) {
    console.warn(`[seed] Failed to create ${uid}:`, err.message);
    return null;
  }
}

function getDocId(doc) {
  if (!doc) return null;
  return doc.documentId ?? doc.id;
}

// Content types to clear before seeding (children first to avoid FK issues)
const SEEDED_CONTENT_TYPES = [
  'api::quiz-question.quiz-question',
  'api::quizze.quizze',
  'api::user-progress.user-progress',
  'api::quiz-submission.quiz-submission',
  'api::course-assignment.course-assignment',
  'api::notification.notification',
  'api::important-link.important-link',
  'api::gallery-item.gallery-item',
  'api::form-template.form-template',
  'api::townhall.townhall',
  'api::announcement.announcement',
  'api::event.event',
  'api::holiday.holiday',
  'api::news.news',
  'api::course-module.course-module',
  'api::course.course',
  'api::company-policy.company-policy',
  'api::news-category.news-category',
  'api::route.route',
  'api::unit-location.unit-location',
  'api::area.area',
  'api::city.city',
  'api::designation.designation',
  'api::department.department',
  'api::course-category.course-category',
  'api::company.company',
];

async function clearSeededData() {
  console.log('Clearing existing seeded data...');
  const limit = 500;
  for (const uid of SEEDED_CONTENT_TYPES) {
    try {
      let totalCleared = 0;
      let hasMore = true;
      while (hasMore) {
        const docs = await strapi.documents(uid).findMany({
          status: 'draft',
          limit,
          start: 0,
        });
        const list = Array.isArray(docs) ? docs : [];
        for (const doc of list) {
          const id = doc?.documentId ?? doc?.id;
          if (id) {
            await strapi.documents(uid).delete({ documentId: id });
            totalCleared++;
          }
        }
        hasMore = list.length >= limit;
      }
      if (totalCleared > 0) console.log(`  Cleared ${totalCleared} from ${uid.split('.').pop()}`);
    } catch (err) {
      console.warn(`  [seed] Could not clear ${uid}:`, err.message);
    }
  }
  console.log('  Done.\n');
}

// Minimal blocks for rich text (Strapi v5 format)
const MINIMAL_BLOCKS = [
  { type: 'paragraph', children: [{ type: 'text', text: 'Sample content for this entry.' }] },
];

async function seedPortal() {
  console.log('Seeding UI-LM Portal with dummy data...\n');

  await clearSeededData();

  // 1. Company (no deps) - exactly 2 entries: AIA and VEGA
  const companies = [];
  const companyNames = ['AIA', 'VEGA'];
  for (let i = 0; i < companyNames.length; i++) {
    const name = companyNames[i];
    let doc = await strapi.documents('api::company.company').findFirst({ filters: { name: { $eqi: name } } });
    if (!doc) {
      doc = await createDocument('api::company.company', {
        name,
        website: `https://${name.toLowerCase()}.com`,
        address: `${100 + i} Business Street, City`,
        company_type: 'Corporate',
      });
    }
    if (doc) companies.push(getDocId(doc));
  }
  console.log(`  Company: ${companies.length} entries (AIA, VEGA)`);

  // 2. Department
  const departments = [];
  const departmentIds = []; // raw ids for strapi.db (user.department relation)
  const deptNames = ['HR', 'Engineering', 'Sales', 'Marketing', 'Finance', 'Operations', 'IT', 'Legal', 'Support', 'R&D'];
  for (let i = 0; i < Math.min(ENTRY_COUNT, deptNames.length); i++) {
    const doc = await createDocument('api::department.department', {
      name: deptNames[i],
      department_code: `DEPT-${100 + i}`,
      description: `Department for ${deptNames[i]}`,
      company: companies[i % companies.length],
    });
    if (doc) {
      departments.push(getDocId(doc));
      departmentIds.push(doc.id ?? doc.documentId);
    }
  }
  console.log(`  Department: ${departments.length} entries`);

  // 3. Designation
  const designations = [];
  const desigNames = ['Manager', 'Developer', 'Analyst', 'Executive', 'Coordinator', 'Specialist', 'Lead', 'Director'];
  for (let i = 0; i < Math.min(ENTRY_COUNT, desigNames.length); i++) {
    const doc = await createDocument('api::designation.designation', {
      title: desigNames[i],
      department: departments[i % departments.length],
      company: companies[i % companies.length],
    });
    if (doc) designations.push(getDocId(doc));
  }
  console.log(`  Designation: ${designations.length} entries`);

  // 4. Course Category - use unique names for idempotency
  const courseCategories = [];
  const catNames = ['Technical', 'Soft Skills', 'Compliance', 'Leadership', 'Product', 'Sales', 'Safety', 'Onboarding'];
  for (let i = 0; i < Math.min(ENTRY_COUNT, catNames.length); i++) {
    const name = `Seed ${catNames[i]} ${i + 1}`;
    let doc = await strapi.documents('api::course-category.course-category').findFirst({ filters: { name } });
    if (!doc) {
      doc = await createDocument('api::course-category.course-category', {
        name,
        description: `Category for ${catNames[i]} courses`,
      });
    }
    if (doc) courseCategories.push(getDocId(doc));
  }
  console.log(`  Course Category: ${courseCategories.length} entries`);

  // 5. City
  const cities = [];
  const cityData = [
    { name: 'Mumbai', state: 'Maharashtra', country: 'India' },
    { name: 'Delhi', state: 'Delhi', country: 'India' },
    { name: 'Bangalore', state: 'Karnataka', country: 'India' },
    { name: 'Chennai', state: 'Tamil Nadu', country: 'India' },
    { name: 'Hyderabad', state: 'Telangana', country: 'India' },
    { name: 'Pune', state: 'Maharashtra', country: 'India' },
  ];
  for (let i = 0; i < Math.min(ENTRY_COUNT, cityData.length); i++) {
    const doc = await createDocument('api::city.city', {
      ...cityData[i],
      company: companies[i % companies.length],
    });
    if (doc) cities.push(getDocId(doc));
  }
  console.log(`  City: ${cities.length} entries`);

  // 6. Area (minimal - for FK only)
  const areas = [];
  for (let i = 1; i <= 4; i++) {
    const doc = await createDocument('api::area.area', {
      name: `Area ${i}`,
      description: `Geographic area ${i}`,
      city: cities[i % cities.length],
      company: companies[i % companies.length],
    });
    if (doc) areas.push(getDocId(doc));
  }
  console.log(`  Area: ${areas.length} entries`);

  // 7. Unit Location (minimal - for FK only)
  const unitLocations = [];
  for (let i = 1; i <= 4; i++) {
    const doc = await createDocument('api::unit-location.unit-location', {
      name: `Unit Location ${i}`,
      address: `${200 + i} Industrial Park, Area ${i}`,
      contact: `+91-98765${String(i).padStart(5, '0')}`,
      is_office_location: i % 2 === 0,
      is_factory_location: i % 2 === 1,
      area: areas[i % areas.length],
      company: companies[i % companies.length],
    });
    if (doc) unitLocations.push(getDocId(doc));
  }
  console.log(`  Unit Location: ${unitLocations.length} entries`);

  // 8. Route
  const routes = [];
  for (let i = 1; i <= ENTRY_COUNT; i++) {
    const doc = await createDocument('api::route.route', {
      route_name: `Route ${i}`,
      bus_number: `BUS-${100 + i}`,
      description: `Bus route ${i} description`,
      bus_stops: [{ name: `Stop ${i}A` }, { name: `Stop ${i}B` }],
      unit_location: unitLocations[i % unitLocations.length],
      area: areas[i % areas.length],
      company: companies[i % companies.length],
    });
    if (doc) routes.push(getDocId(doc));
  }
  console.log(`  Route: ${routes.length} entries`);

  // 9. News Category
  const newsCategories = [];
  const newsCatNames = ['Updates', 'Events', 'Policy', 'HR', 'Tech', 'Culture', 'Awards', 'Announcements'];
  for (let i = 0; i < Math.min(ENTRY_COUNT, newsCatNames.length); i++) {
    const doc = await createDocument('api::news-category.news-category', {
      name: newsCatNames[i],
      description: `News category for ${newsCatNames[i]}`,
      company: companies[i % companies.length],
    });
    if (doc) newsCategories.push(getDocId(doc));
  }
  console.log(`  News Category: ${newsCategories.length} entries`);

  // 10. Company Policy (minimal - not used in analytics)
  const policies = [];
  for (let i = 1; i <= 3; i++) {
    const doc = await createDocument('api::company-policy.company-policy', {
      title: `Policy ${i}: Sample Policy Title`,
      description: `This is the description for company policy ${i}. It outlines guidelines and procedures.`,
      tags: `policy,guidelines,${i}`,
      company: companies[i % companies.length],
    });
    if (doc) policies.push(getDocId(doc));
  }
  console.log(`  Company Policy: ${policies.length} entries`);

  // 11. Course (needs course_category, company; thumbnail optional - omit to avoid media relation issues)
  const courses = [];
  for (let i = 1; i <= ENTRY_COUNT; i++) {
    const doc = await createDocument('api::course.course', {
      title: `Course ${i}: Introduction to Topic ${i}`,
      description: MINIMAL_BLOCKS,
      duration_hours: 2 + (i % 5),
      passing_score: 70,
      difficulty_level: ['Beginner', 'Intermediate', 'Advanced'][i % 3],
      is_active: true,
      is_mandatory: i % 3 === 0,
      is_orientation_course: i === 1,
      is_optional: i % 3 !== 0,
      course_category: courseCategories[i % courseCategories.length],
      company: companies[i % companies.length],
    });
    if (doc) courses.push(getDocId(doc));
  }
  console.log(`  Course: ${courses.length} entries`);

  // 12. Course Module (use Text type to avoid media)
  const modules = [];
  if (courses.length > 0) {
  for (let i = 1; i <= ENTRY_COUNT; i++) {
    const doc = await createDocument('api::course-module.course-module', {
      title: `Module ${i}: Learning Unit ${i}`,
      course: courses[i % courses.length],
      order: i,
      module_content_type: 'Text',
      text_content: MINIMAL_BLOCKS,
      duration_minutes: 15 + i * 5,
      description: `Module ${i} description`,
    });
    if (doc) modules.push(getDocId(doc));
  }
  }
  console.log(`  Course Module: ${modules.length} entries`);

  // 13. News (for Overall Analytics - News by Category bar chart)
  const newsItems = [];
  const defaultImage = await getOrUploadImage('default-image.png');
  if (defaultImage) {
    // Ensure each news category has 2+ entries for meaningful bar chart
    for (let i = 0; i < newsCategories.length; i++) {
      for (let j = 0; j < 2; j++) {
        const doc = await createDocument('api::news.news', {
          title: `News: ${newsCatNames[i]} ${j + 1}`,
          description: `News content for ${newsCatNames[i]} category.`,
          cover_image: defaultImage,
          published_date: new Date(Date.now() - (i * 2 + j) * 86400000),
          is_featured: i === 0 && j === 0,
          news_category: newsCategories[i],
          company: companies[i % companies.length],
        });
        if (doc) newsItems.push(getDocId(doc));
      }
    }
  }
  console.log(`  News: ${newsItems.length} entries (by category for viz)`);

  // 14. Holiday (for Overall Analytics - Holidays by Month donut chart)
  const holidays = [];
  if (defaultImage) {
    const holidayTitles = ['Republic Day', 'Holi', 'Diwali', 'Christmas', 'Eid', 'Independence Day', 'Gandhi Jayanti', 'New Year', 'Makar Sankranti', 'Maha Shivaratri', 'Ram Navami', 'Buddha Purnima'];
    // Spread across Jan-Dec 2025 for meaningful "Holidays by Month" donut
    for (let i = 0; i < holidayTitles.length; i++) {
      const doc = await createDocument('api::holiday.holiday', {
        title: holidayTitles[i],
        date: new Date(2025, i % 12, 15),
        image: defaultImage,
        description: `Holiday: ${holidayTitles[i]}`,
        holiday_for: 'All',
      });
      if (doc) holidays.push(getDocId(doc));
    }
  }
  console.log(`  Holiday: ${holidays.length} entries (spread across months for viz)`);

  // 15. Event (for Overall Analytics - Events by Type bar chart)
  const events = [];
  const eventTypes = ['Workshop', 'Webinar', 'Conference', 'Meetup'];
  if (defaultImage) {
    // Ensure each event type has 2+ entries for meaningful bar chart
    for (let i = 0; i < eventTypes.length; i++) {
      for (let j = 0; j < 3; j++) {
        const start = new Date(Date.now() + (i * 3 + j) * 86400000);
        const end = new Date(start.getTime() + 2 * 3600000);
        const doc = await createDocument('api::event.event', {
          title: `${eventTypes[i]} ${j + 1}`,
          description: `${eventTypes[i]} event description.`,
          start_date: start,
          end_date: end,
          event_owner: `Organizer`,
          banner_image: defaultImage,
          event_location: `Venue ${i}-${j}`,
          event_type: eventTypes[i],
          event_created_for: 'All',
        });
        if (doc) events.push(getDocId(doc));
      }
    }
  }
  console.log(`  Event: ${events.length} entries (by type for viz)`);

  // 16. Announcement (minimal - not used in analytics)
  const announcements = [];
  for (let i = 1; i <= 3; i++) {
    const start = new Date();
    const end = new Date(Date.now() + 30 * 86400000);
    const doc = await createDocument('api::announcement.announcement', {
      title: `Announcement ${i}`,
      message: `This is announcement message ${i}. Important information for all employees.`,
      target_type: 'All',
      is_important: i % 4 === 0,
      start_date: start,
      end_date: end,
      company: companies[i % companies.length],
    });
    if (doc) announcements.push(getDocId(doc));
  }
  console.log(`  Announcement: ${announcements.length} entries`);

  // 17. Townhall (for Overall Analytics - Townhall Matrix bar chart)
  // Note: Video requires video file; we use Pdf only with default-image as doc placeholder
  const townhalls = [];
  const townhallFile = await getOrUploadImage('default-image.png');
  if (townhallFile) {
    for (let i = 1; i <= 8; i++) {
      const doc = await createDocument('api::townhall.townhall', {
        name: `Townhall Meeting ${i}`,
        meeting_date: new Date(2025, (i - 1) % 12, 15),
        description: `Townhall meeting ${i} - Q&A and updates.`,
        meeting_content_type: 'Pdf',
        meeting_document: townhallFile,
      });
      if (doc) townhalls.push(getDocId(doc));
    }
  }
  console.log(`  Townhall: ${townhalls.length} entries`);

  // 18. Form Template (minimal - not used in analytics)
  const formTemplates = [];
  for (let i = 1; i <= 3; i++) {
    const doc = await createDocument('api::form-template.form-template', {
      title: `Form Template ${i}`,
      form_type: 'URL',
      form_url: `https://forms.example.com/form${i}`,
      description: `Form template ${i} description`,
      company: companies[i % companies.length],
    });
    if (doc) formTemplates.push(getDocId(doc));
  }
  console.log(`  Form Template: ${formTemplates.length} entries`);

  // 19. Gallery Item (requires media)
  const galleryItems = [];
  if (defaultImage) {
    for (let i = 1; i <= ENTRY_COUNT; i++) {
      const doc = await createDocument('api::gallery-item.gallery-item', {
        title: `Gallery Item ${i}`,
        media: defaultImage,
        media_type: 'Image',
        company: companies[i % companies.length],
      });
      if (doc) galleryItems.push(getDocId(doc));
    }
  }
  console.log(`  Gallery Item: ${galleryItems.length} entries`);

  // 20. Important Link (minimal - not used in analytics)
  const importantLinks = [];
  if (defaultImage) {
    for (let i = 1; i <= 3; i++) {
      const doc = await createDocument('api::important-link.important-link', {
        title: `Important Link ${i}`,
        url: `https://link${i}.example.com`,
        display_order: i,
        icon: { connect: [defaultImage] },
        company: companies[i % companies.length],
      });
      if (doc) importantLinks.push(getDocId(doc));
    }
  }
  console.log(`  Important Link: ${importantLinks.length} entries`);

  // 21. Quizze
  const quizzes = [];
  for (let i = 1; i <= ENTRY_COUNT; i++) {
    const doc = await createDocument('api::quizze.quizze', {
      title: `Quiz ${i}: Assessment`,
      instructions: `Complete this quiz for course assessment.`,
      completion_time: 15,
      max_attempts: 3,
      reattempt_after: 24,
      course: courses[i % courses.length],
    });
    if (doc) quizzes.push(getDocId(doc));
  }
  console.log(`  Quizze: ${quizzes.length} entries`);

  // 22. Quiz Question (requires options component)
  const quizQuestions = [];
  for (let i = 1; i <= ENTRY_COUNT; i++) {
    const doc = await createDocument('api::quiz-question.quiz-question', {
      question_text: `Sample question ${i}: What is the correct answer?`,
      question_type: 'Multiple_choice',
      order: i,
      points: 1,
      quiz: quizzes[i % quizzes.length],
      options: [
        { option_key: 'A', option_label: 'Option A' },
        { option_key: 'B', option_label: 'Option B' },
        { option_key: 'C', option_label: 'Option C' },
      ],
    });
    if (doc) quizQuestions.push(getDocId(doc));
  }
  console.log(`  Quiz Question: ${quizQuestions.length} entries`);

  // 23. User-dependent data (Learning & Overall Analytics)
  const users = await strapi.db.query('plugin::users-permissions.user').findMany({ limit: 25 });
  const userList = Array.isArray(users) ? users : [];
  const userIds = userList.map((u) => u.documentId ?? u.id).filter(Boolean);

  // Set department and company on users for "By Department" chart in Learning Analytics
  const userCompanies = ['AIA', 'Vega'];
  for (let i = 0; i < userList.length; i++) {
    try {
      const u = userList[i];
      if (!u?.id) continue;
      const deptId = departmentIds[i % departmentIds.length];
      if (!deptId) continue;
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: u.id },
        data: {
          company: userCompanies[i % 2],
          department: deptId,
        },
      });
    } catch (e) {
      // Ignore - user schema may differ (e.g. required fields)
    }
  }
  if (userIds.length > 0) {
    const firstUserId = userIds[0];

    // Notifications (minimal - not used in analytics)
    for (let i = 1; i <= 5; i++) {
      await createDocument('api::notification.notification', {
        type: ['Course_assigned', 'Quiz_passed', 'Certificate_issued', 'Due_date_reminder'][i % 4],
        title: `Notification ${i}`,
        message: `Notification message ${i}`,
        user: firstUserId,
      });
    }
    console.log(`  Notification: 5 entries`);

    // Course Assignment (minimal)
    for (let i = 1; i <= 5; i++) {
      await createDocument('api::course-assignment.course-assignment', {
        assignment_target_type: 'Individual',
        due_date: new Date(Date.now() + 14 * 86400000),
        assigned_by: firstUserId,
        course: courses[i % courses.length],
        individual_user: [firstUserId],
      });
    }
    console.log(`  Course Assignment: 5 entries`);

    // Quiz Submission (for Learning Analytics - pass rate, avg score)
    const now = new Date();
    for (let i = 0; i < VIZ_ENTRY_COUNT; i++) {
      const score = 55 + (i * 7) % 45;
      const passed = score >= 70;
      const subDate = new Date(now);
      subDate.setDate(subDate.getDate() - i);
      await createDocument('api::quiz-submission.quiz-submission', {
        answers: { q1: 'A', q2: 'B' },
        score,
        passed,
        attempt_number: 1,
        submitted_by: userIds[i % userIds.length],
        quiz: quizzes[i % quizzes.length],
        submitted_at: subDate,
      });
    }
    console.log(`  Quiz Submission: ${VIZ_ENTRY_COUNT} entries (varied scores for viz)`);

    // User Progress (for Learning Analytics - status donut, category bar, department bar, monthly trend)
    const statuses = ['Not_started', 'In_progress', 'Completed', 'Failed'];
    const baseDate = new Date();
    baseDate.setMonth(baseDate.getMonth() - 6);
    for (let i = 0; i < VIZ_ENTRY_COUNT; i++) {
      const status = statuses[i % 4];
      const isCompleted = status === 'Completed';
      const lastAccessed = new Date(baseDate);
      lastAccessed.setDate(lastAccessed.getDate() + i * 3);
      const completedAt = isCompleted ? lastAccessed.toISOString() : null;
      await createDocument('api::user-progress.user-progress', {
        progress_status: status,
        progress_percentage: isCompleted ? 100 : [0, 25, 50, 75][i % 4],
        completed_modules: isCompleted ? [{ id: 1 }] : [],
        last_accessed_at: lastAccessed,
        time_spent_minutes: 15 + (i * 5) % 120,
        certificate_issued: isCompleted && i % 3 === 0,
        completed_at: completedAt,
        user: userIds[i % userIds.length],
        course: courses[i % courses.length],
      });
    }
    console.log(`  User Progress: ${VIZ_ENTRY_COUNT} entries (status/category/department/trend for viz)`);
  } else {
    console.log('  Notification, Course Assignment, Quiz Submission, User Progress: Skipped (no users - create users first)');
  }

  console.log('\nSeed completed!');
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');
  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();
  app.log.level = 'error';

  try {
    await seedPortal();
  } catch (err) {
    console.error('Seed failed:', err);
  } finally {
    try {
      await app.destroy();
    } catch (e) {
      // Ignore destroy errors (e.g. pool aborted)
    }
    process.exit(0);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
