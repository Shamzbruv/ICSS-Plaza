const entry=([title,text])=>({title,text});

function career({id,label,description,layout,accent,background,ink,font='sans',hero,artAlt,announcement,about,offer,pages,faq,contact}) {
 const art='/assets/template-'+id+'.svg';
 const [tagline,heroTitle,heroText,heroButton]=hero;
 const [navAboutLabel,aboutTitle,story]=about;
 const [navContactLabel,contactIntro]=contact;
 return {id,label,description,group:'professional',art,look:layout,items:[],
  settings:{siteMode:'enquiries',layout,accent,background,ink,font,heroImage:art,heroAlt:artAlt,
   heroDestination:'contact',tagline,heroTitle,heroText,heroButton,announcement,navAboutLabel,aboutTitle,about:story,
   navContactLabel,contactIntro,footerText:tagline,customPages:pages.map(([title,content])=>({title,content})),
   privacy:'We use the contact details you share to answer your enquiry and follow up on your request. Contact us if you have questions about your information.',
   shipping:'',returns:'',terms:'',categories:[],showHero:true,showAbout:true,
   sections:[{id:'hero',type:'hero'},
    {id:'starter-options',type:'benefits',title:offer[0],tone:'soft',items:offer[1].map(entry)},
    {id:'starter-next',type:'promo',tone:'accent',title:offer[2],text:offer[3],button:'Explore '+pages[0][0].toLowerCase(),link:'#page-0'},
    {id:'catalog',type:'catalog',hidden:true},{id:'about',type:'about'},
    {id:'starter-questions',type:'faq',page:'contact',title:'Good to know',items:faq.map(entry)}]
  }};
}

export const careerTemplates=[
 career({
  id:'driving-lessons',label:'Driving Lessons',description:'For instructors and driving schools. Show lesson options, test prep and where you teach.',
  layout:'market',accent:'#9d3a1b',background:'#fff7e7',ink:'#242b2e',
  hero:['BEHIND THE WHEEL · JAMAICA','Your road starts here.','Start from the basics, brush up after a break or get ready for your road test with lessons paced for you.','Ask about lessons'],
  artAlt:'A learner car on a curved road through warm, golden hills',
  announcement:'First lessons · Refresher drives · Road test practice',
  about:['The instructor','A steady start behind the wheel','Good driving is built one habit at a time. We break each lesson into clear steps and agree what to practise next so you can track your progress.'],
  offer:['Find your starting point',[
   ['First time driving','Get comfortable with the controls, steering, stopping and safe observation.'],
   ['Refresher lessons','Build confidence with parking, traffic and routes that have been a challenge.'],
   ['Road test practice','Work through manoeuvres and routines, with clear feedback on what to improve.']
  ],'Start at your own pace','See what to expect before you get in the driver’s seat.'],
  pages:[['Lesson options','BEGINNER LESSONS\nStart with the controls, mirror checks and smooth starts and stops. Tell us whether you’ve driven before so we can plan a first session.\n\nREFRESHER DRIVES\nPick the skills you want to work on, from parking to navigating busier roads.\n\nROAD TEST PRACTICE\nTell us your test date if you have one, and we’ll discuss a practical preparation plan.'],
   ['Areas & availability','WHERE WE MEET\nShare your parish and a nearby landmark. We’ll confirm whether we cover your area and agree a suitable meeting point.\n\nWHAT TO INCLUDE\nLet us know your experience level, your preferred days and whether you want to practise in a manual or automatic vehicle.']],
  faq:[['Can I start with no experience?','Yes. Mention that this would be your first lesson so we can plan around the basics.'],['How do I get a price?','Send the lesson type and area you have in mind, and ask for the current rate and available times.']],
  contact:['Lesson enquiries','Tell us your parish, experience level and preferred days so we can discuss a lesson that fits.']
 }),
 career({
  id:'pastor-ministry',label:'Pastor & Ministry',description:'For pastors, churches and ministries. Welcome first-time visitors, share messages and invite speaking enquiries.',
  layout:'editorial',accent:'#62445d',background:'#fbf3e8',ink:'#362838',font:'serif',
  hero:['FAITH · FELLOWSHIP · SERVICE','There’s a place for you here.','Join us for worship, find a message for the week, or reach out to learn more about the ministry.','Connect with the ministry'],
  artAlt:'A tall stained glass window lit in gold, plum and soft rose',
  announcement:'New here? Start with Plan a visit.',
  about:['Our ministry','A community rooted in faith','We gather for worship, learn together and look for practical ways to care for our neighbours. Whether this is your first visit or you’re looking for a place to serve, you’re welcome to reach out.'],
  offer:['Find your next step',[
   ['Visit for worship','Learn what to expect and ask about service times, directions and accessibility.'],
   ['Explore messages','Find recent sermons, scripture readings and notes for reflection.'],
   ['Invite the pastor','Share the event, date and topic you have in mind when asking about a speaking invitation.']
  ],'Your first visit starts here','Come as you are. If you have questions about the service, our team can help you plan ahead.'],
  pages:[['Plan a visit','WHAT TO EXPECT\nOur gatherings make room for worship, prayer and a message. If it’s your first time, ask what an ordinary service looks like.\n\nBEFORE YOU COME\nContact the ministry for the current service schedule, directions and any accessibility arrangements.'],
   ['Sermons & messages','REFLECT DURING THE WEEK\nTake a moment to reread the scripture from a recent message. What stands out? Is there one thing you can put into practice this week?\n\nFOLLOW THE MINISTRY\nAsk the ministry where to find the latest message or when the next teaching series starts.']],
  faq:[['Can I invite the pastor to speak?','Yes. Share the event date, venue, audience and topic so the ministry can discuss the invitation.'],['Can someone help me plan a first visit?','Yes. Reach out with any questions about service times, directions or accessibility.']],
  contact:['Connect','Ask about visiting, ministry activities or a speaking invitation. For a sensitive matter, ask for a private follow-up before sharing personal details.']
 }),
 career({
  id:'catering',label:'Catering & Events',description:'For caterers, bakers and private chefs. Present menus and invite event quotes.',
  layout:'boutique',accent:'#884025',background:'#fff4df',ink:'#312317',font:'serif',
  hero:['MENUS · CELEBRATIONS · OFFICE LUNCHES','Good food brings us together.','From a family celebration to a work lunch, start with a menu built around your guests and the occasion.','Request an event quote'],
  artAlt:'A table set with Jamaican-inspired dishes and citrus on warm linen',
  announcement:'Celebrations · Small gatherings · Team lunches',
  about:['Our kitchen','Made for the people around your table','The best menus fit the gathering. Tell us who’s coming and how you want to serve them, and we’ll work through the options together.'],
  offer:['A menu for the moment',[
   ['Family celebrations','Plan a menu around the dishes and traditions your guests love.'],['Work lunches','Discuss easy-to-serve meals with portions suited to your team.'],['Private dining','Share your venue and occasion so we can talk through the menu and service.']
  ],'Bring your guest list','Start with a date, a location and what you’d like to serve.'],
  pages:[['Menu ideas','PARTY TABLES\nBuild a spread around mains, sides and something sweet. Tell us about dietary needs before choosing a menu.\n\nOFFICE LUNCHES\nAsk about individually packed lunches or trays for sharing.'],
   ['Event planning','FOR YOUR QUOTE\nSend your date, parish, guest count and preferred style of service. Let us know whether there is a kitchen at the venue.\n\nDIETARY NEEDS\nShare any requirements early so we can explain what we can accommodate.']],
  faq:[['Can I customise a menu?','Yes. Share what you have in mind and we’ll discuss suitable options.'],['When is my date confirmed?','Ask about availability and confirm the menu, quote and booking terms directly with the caterer.']],
  contact:['Request a quote','Share your date, venue, guest count and any dietary needs so we can start planning.']
 }),
 career({
  id:'photography',label:'Photography & Video',description:'For photographers and videographers. Showcase your style, session options and packages.',
  layout:'runway',accent:'#643f86',background:'#f4edfb',ink:'#261e35',
  hero:['PORTRAITS · EVENTS · BRAND STORIES','Make the moment last.','Photos and films for milestones, personal brands and the people you want to remember as they are.','Ask about a shoot'],
  artAlt:'A camera lens and layered photo contact sheets on a violet backdrop',
  announcement:'Available for portraits, events and brand content enquiries',
  about:['Behind the lens','A little direction, room to be yourself','We start with a conversation about the people, the place and what you want to remember. That helps us choose a setting and pace that feel right.'],
  offer:['What we create',[
   ['Portraits','Personal, family and graduation sessions built around a look you’re comfortable with.'],['Events','Tell us the moments and people you want covered, from arrivals to the last toast.'],['Brand content','Plan photo or video work around where you’ll use it and the story you want to tell.']
  ],'Let’s plan the shot','Choose a session type and tell us what you want the finished images to do.'],
  pages:[['Session options','PORTRAITS\nShare how many people will take part, the setting you want and any outfit ideas.\n\nEVENTS\nSend your schedule, location and the moments you want covered.\n\nBRANDS\nTell us which channels the images or footage are for and when you need them.'],
   ['Preparing for your shoot','BEFORE THE DAY\nWe’ll discuss the location, outfits, timing and any must-have shots.\n\nAFTER THE SHOOT\nAsk how the finished work will be delivered, what usage is included and when you can expect it.']],
  faq:[['Do you travel?','Include the parish and venue in your enquiry so we can confirm travel and any associated fees.'],['Do you offer video?','Tell us if you need short clips, an event film or another format. We’ll discuss the work and availability.']],
  contact:['Shoot enquiries','Share the date, location, type of shoot and how you plan to use the photos or video.']
 }),
 career({
  id:'tutoring',label:'Tutoring & Coaching',description:'For tutors and learning coaches. Share subjects, lesson formats and exam preparation options.',
  layout:'minimal',accent:'#235f87',background:'#eef8f7',ink:'#173341',
  hero:['STUDY SKILLS · SUBJECT SUPPORT · EXAM PREP','Small steps. Stronger skills.','Get support with the topics that feel stuck, learn how to practise, and build a manageable plan for the next exam.','Ask about tutoring'],
  artAlt:'An open notebook, pencil and study cards on a mint and blue desk',
  announcement:'One-to-one support and structured exam preparation',
  about:['Our approach','Make the next step clear','We start by finding out what the learner already understands. Then we work through one skill at a time and use practice to decide what to tackle next.'],
  offer:['Support for the way you learn',[
   ['Subject support','Work through difficult topics and learn how to spot mistakes early.'],['Exam preparation','Practise questions, review your answers and work on timing.'],['Study routines','Build a practical plan for revision and independent practice.']
  ],'Start with a goal','Tell us the subject, grade or exam and the areas that need attention.'],
  pages:[['Subjects & formats','SUBJECT SUPPORT\nAsk which subjects and grade levels are currently available. Share a topic or example question you’re working on.\n\nEXAM SUPPORT\nTell us if you’re preparing for PEP, CSEC or another exam so we can discuss the right fit.'],
   ['Getting started','FIRST CONVERSATION\nA parent, guardian or adult learner can share the subject, goals, availability and preferred lesson format.\n\nBEFORE THE FIRST LESSON\nAsk about the materials to bring and how progress will be reviewed.']],
  faq:[['How do I choose a lesson format?','Tell us whether you prefer online or in-person support and ask what is available.'],['Can we focus on one topic?','Yes. Share the topic or goal so the tutor can discuss a targeted session.']],
  contact:['Tutoring enquiries','Send the subject, grade or exam and preferred days. Please leave out student records or other sensitive details.']
 }),
 career({
  id:'home-services',label:'Home Services',description:'For tradespeople and maintenance teams. Explain your services, coverage and how to request a quote.',
  layout:'market',accent:'#21645e',background:'#f0f5e9',ink:'#1e342c',
  hero:['REPAIRS · INSTALLATIONS · UPKEEP','Get the job done right.','Tell us what needs attention, where you’re based, and when you’d like the work done.','Request a site visit'],
  artAlt:'An architectural house drawing with a tape measure and hand tools',
  announcement:'Home and small business maintenance enquiries',
  about:['The team','Clear communication from the first visit','We start by understanding the job. We’ll discuss access, materials and timing so you know what needs to be agreed before work starts.'],
  offer:['How we can help',[
   ['Repairs','Describe the issue, when it started and whether it affects more than one room or area.'],['Installation','Share the item, measurements if available and any access constraints.'],['Maintenance','Ask about one-off upkeep or a schedule for a property you look after.']
  ],'A clearer quote starts here','Tell us the job type and parish so we can discuss the next step.'],
  pages:[['Services offered','REPAIRS\nDescribe what isn’t working or what needs replacing. Photos can help explain the issue when it’s safe to share them.\n\nINSTALLATION AND UPKEEP\nList the items or rooms involved so we can work out the scope. Confirm that the provider handles that kind of job.'],
   ['Coverage & quotes','SERVICE AREA\nGive your parish and community when you contact us, and ask if we cover that area.\n\nQUOTES\nWe’ll tell you whether an on-site visit is needed. Ask what is included in the estimate and how changes would be agreed.']],
  faq:[['Can I get a quote without a site visit?','Some jobs can be discussed from a description and photos. Others need measurements or an on-site inspection.'],['What should I send first?','Start with your parish and a short description. Leave out door codes and other private access details.']],
  contact:['Request a quote','Include your parish, a short job description and your preferred time frame.']
 })
];
