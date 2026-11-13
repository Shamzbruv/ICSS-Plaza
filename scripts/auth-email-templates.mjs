import { authTemplates } from '../src/email-design.js';

const templates=authTemplates();
console.log(JSON.stringify(Object.fromEntries(Object.entries(templates).flatMap(([type,value])=>[
 [`mailer_subjects_${type}`,value.subject],
 [`mailer_templates_${type}_content`,value.html]
])),null,2));
