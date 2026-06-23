const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Groq = require('groq-sdk');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `You are evaluating a job description for Anishka Pateriya, a recent Purdue University graduate with a B.S. in Business Analytics and Information Management and a certificate/minor in Applications in Data Science.

Her ideal roles are business-facing, analytical, and cross-functional. She is targeting entry-level or near-entry-level roles such as Business Analyst, Strategy & Operations Analyst, Operations Analyst, Product Analyst, Program Analyst, Project Coordinator, Data Analyst, Business Operations Analyst, Process Transformation Analyst, or similar roles.

Her strongest preferences:
- Enjoys analyzing data, solving business problems, improving processes, building dashboards, researching, forecasting, managing projects, coordinating teams, running meetings, talking to clients/stakeholders, creating models, and presenting insights.
- Likes roles that combine business, data, operations, strategy, and stakeholder communication.
- Prefers work where analysis leads to recommendations or process improvements.
- Is open to some technical work, SQL, Excel, Tableau, Power BI, dashboards, data cleaning, and modeling when tied to business decisions.
- Would like career paths that could lead to project/program management, product management, strategy & operations, business operations, or analytics leadership.

Her dislikes / poor fits:
- Does not want cold calling, quota-carrying sales, pure sales, or business development rep roles.
- Does not want repetitive manual work, admin-only work, data entry-heavy work, or documentation-only roles.
- Does not want coding all day as the main job.
- Does not want highly mathematical, advanced statistics, or heavy machine learning research roles.
- Does not want unnecessary technical troubleshooting, IT support, help desk, or customer service queue work.
- Does not want phone-heavy customer support roles.

Her background:
- Recent graduate, May 2026.
- Degree: Business Analytics and Information Management from Purdue University.
- GPA: 3.00 overall, not listed unless required.
- Skills: SQL, Python, R, Tableau, Excel, Power BI-adjacent dashboarding, MS Project, BigQuery, PySpark, pandas, basic JavaScript/Java/HTML/CSS.
- Experience includes:
  * Software, AI, and Data Analytics Intern at DevAI: worked on intent classification, auto-tagging, IT workflow mapping, and documentation.
  * Business Strategy Consulting Externship: worked with a startup on go-to-market strategy, pricing, customer acquisition, and MVP planning.
  * Data Mine with Nationwide: supported preliminary research for predictive analytics in insurance.
  * Data Mine with Nuvve: analyzed large-scale EV/operational data and supported usage behavior/forecasting research.
  * NASHA Director: led 16 collegiate teams, 600+ attendees, 23 board members, logistics, operations, and cross-functional execution.

Hard disqualifiers (if any of these are present, recommend Avoid):
- Requires 3+ years of full-time experience
- Requires 2+ years in a very specific function she doesn't have (investment banking, underwriting, procurement, Salesforce admin, accounting, FP&A, HR)
- Mainly cold calling, lead generation, quota-carrying sales, or BDR work
- Mostly customer service, call center, or phone-heavy operations
- Primarily software engineering, backend development, or ML engineering
- Requires CPA, CFA, Series licenses, PMP, Six Sigma Black Belt, security clearance
- Internship-only role requiring current student status
- Entry level role that still requires 5+ years of experience

Evaluate the job description and respond ONLY with a JSON object in exactly this format, no other text:
{
  "enjoyment_score": <1-10>,
  "qualification_score": <1-10>,
  "recommendation": "<Strong Apply | Apply | Maybe | Deprioritize | Avoid>",
  "best_fit_reasons": "<2-3 sentences>",
  "risk_factors": "<1-2 sentences>",
  "resume_positioning": "<1 sentence advice>",
  "hard_disqualifier": "<none, or describe the disqualifier found>",
  "tailor_level": "<heavily | lightly | skip>"
}`;

const POSITIVE_SIGNALS = [
  'business analyst', 'strategy', 'operations analyst', 'product analyst',
  'program analyst', 'process improvement', 'cross-functional', 'stakeholder',
  'dashboard', 'reporting', 'tableau', 'power bi', 'sql', 'excel',
  'forecasting', 'kpi', 'root cause', 'go-to-market', 'pricing',
  'operational efficiency', 'data-driven', 'entry level', 'new grad',
  'rotational', 'analyst program', 'project management', 'business insights',
  'business operations', 'workflow', 'process optimization'
];

const NEGATIVE_SIGNALS = [
  'cold call', 'quota', 'sales representative', 'account executive',
  'software engineer', 'machine learning engineer', 'data engineer',
  'call center', 'customer support', 'help desk', 'it support',
  'must be a us citizen', 'us citizenship required', 'secret clearance',
  'top secret', 'ts/sci', 'dod clearance', 'must be citizen', 'citizens only',
  'requires 5+ years', 'requires 4+ years', '5 years of experience',
  '4 years of experience', 'cpa required', 'cfa required', 'series 7',
  'currently enrolled', 'current student', 'pursuing a degree'
];

function preFilter(job) {
  const text = (job.title + ' ' + job.description).toLowerCase();
  const hasNegative = NEGATIVE_SIGNALS.some(s => text.includes(s));
  if (hasNegative) return false;
  const positiveCount = POSITIVE_SIGNALS.filter(s => text.includes(s)).length;
  return positiveCount >= 1;
}

app.get('/api/jobs', async (req, res) => {
  try {
    const searchTerms = [
      'business analyst', 'strategy operations analyst', 'operations analyst',
      'product analyst', 'program analyst', 'business operations analyst',
      'process improvement analyst', 'data analyst business'
    ];

    const term = req.query.term || searchTerms[Math.floor(Math.random() * searchTerms.length)];

    const response = await axios.get(
      `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${process.env.ADZUNA_APP_ID}&app_key=${process.env.ADZUNA_APP_KEY}&results_per_page=50&what=${encodeURIComponent(term)}&sort_by=date`
    );

    const jobs = response.data.results.map(job => ({
      id: job.id,
      title: job.title,
      company: job.company?.display_name || 'Unknown',
      location: job.location?.display_name || 'Unknown',
      description: job.description?.slice(0, 1500) || '',
      url: job.redirect_url,
      salary_min: job.salary_min,
      salary_max: job.salary_max,
      created: job.created,
      contract_type: job.contract_type || null
    }));

    const filtered = jobs.filter(preFilter);
    console.log(`Fetched ${jobs.length} jobs, ${filtered.length} passed pre-filter`);

    res.json({ jobs: filtered, term });
  } catch (error) {
    console.error('Adzuna error:', error.message);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

app.post('/api/score', async (req, res) => {
  const { description, title, company } = req.body;

  try {
    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Please evaluate this job:\n\nTitle: ${title}\nCompany: ${company}\n\nDescription:\n${description}` }
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 500
    });

    const raw = completion.choices[0].message.content.trim();
    const clean = raw.replace(/```json|```/g, '').trim();
    const scored = JSON.parse(clean);
    res.json(scored);
  } catch (error) {
    console.error('Groq error:', error.message);
    res.status(500).json({ error: 'Failed to score job' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));