import process from "node:process";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");

const courses = [
  {
    title: "UI/UX Design", slug: "ui-ux-design", weeks: 25,
    description: "Research-led interface and experience design from discovery through accessible prototypes, usability validation, handoff, and portfolio presentation.",
    modules: [
      ["Design Foundations", "Human-centred design and the Double Diamond", "Visual design principles", "Design critique and ethical practice"],
      ["User Research", "Research plans and participant recruitment", "Interviews, observation, and surveys", "Synthesis, personas, and journey maps"],
      ["Information Architecture", "Content inventories and mental models", "Card sorting and navigation", "User flows and task analysis"],
      ["Interaction Design", "Sketching and wireframes", "Interaction patterns and states", "Responsive behaviour and microinteractions"],
      ["UI Systems", "Typography, colour, and layout", "Components, tokens, and design systems", "Figma libraries and collaboration"],
      ["Prototyping and Validation", "Prototype fidelity and test planning", "Moderated usability testing", "Findings, prioritisation, and iteration"],
      ["Inclusive Product Experiences", "WCAG and accessible design", "Content design and error prevention", "Cross-device quality assurance"],
      ["Portfolio Capstone", "Product brief and success measures", "End-to-end case study", "Handoff, presentation, and portfolio review"],
    ],
  },
  {
    title: "Product Design", slug: "product-design", weeks: 20,
    description: "End-to-end digital product design combining customer discovery, product strategy, interaction design, experimentation, delivery, and outcome measurement.",
    modules: [
      ["Product Thinking", "Customer problems and business outcomes", "Market and competitor analysis", "Product principles and design strategy"],
      ["Discovery", "Assumption mapping and research questions", "Customer interviews and jobs to be done", "Opportunity mapping and problem definition"],
      ["Product Strategy", "Value propositions and positioning", "North-star metrics and guardrails", "Roadmaps, prioritisation, and trade-offs"],
      ["Experience Architecture", "Service blueprints and journeys", "Information architecture and flows", "Edge cases, states, and content"],
      ["Prototyping", "Concept generation and critique", "Interactive prototypes", "Usability studies and iteration"],
      ["Design Systems", "System foundations and tokens", "Reusable components and documentation", "Governance and contribution models"],
      ["Delivery and Experimentation", "Engineering collaboration and handoff", "Experiment design and analytics", "Launch readiness and post-launch learning"],
      ["Product Design Capstone", "Define a measurable product opportunity", "Design and validate the solution", "Case study and stakeholder presentation"],
    ],
  },
  {
    title: "D2C Mentorship", slug: "d2c-mentorship", weeks: 28,
    description: "Build and scale a direct-to-consumer brand through positioning, unit economics, ecommerce, acquisition, retention, operations, and an investor-ready growth plan.",
    modules: [
      ["D2C Fundamentals", "D2C models and channel strategy", "Category, market, and competitor research", "Founder goals and business scorecard"],
      ["Customer and Brand", "Ideal customer profiles and research", "Positioning, promise, and brand story", "Offer architecture and product-market fit"],
      ["Economics and Pricing", "Contribution margin and break-even", "CAC, AOV, LTV, and payback", "Pricing, bundles, and promotion discipline"],
      ["Storefront and Conversion", "Ecommerce architecture and merchandising", "Product pages, trust, and checkout", "Conversion research and experimentation"],
      ["Growth Channels", "Organic content and creator programs", "Paid acquisition and creative testing", "SEO, partnerships, and referral loops"],
      ["Lifecycle and Retention", "Email and SMS journeys", "Loyalty, subscriptions, and community", "Cohorts, churn, and repeat purchase"],
      ["Operations", "Demand planning and inventory", "Fulfilment, returns, and customer support", "Vendors, compliance, and operating rhythms"],
      ["Scale Plan", "Analytics and weekly growth reviews", "Omnichannel and channel conflict", "90-day growth plan and mentor review"],
    ],
  },
  {
    title: "Full Stack Development", slug: "full-stack-development", weeks: 30,
    description: "Job-ready web development covering standards-based frontends, typed application code, APIs, relational data, security, testing, deployment, and team delivery.",
    modules: [
      ["Developer Foundations", "Command line, editors, and the web", "Git, GitHub, and collaborative workflow", "Problem solving and debugging"],
      ["Web Foundations", "Semantic HTML and web standards", "Modern CSS and responsive layout", "Accessibility and inclusive interfaces"],
      ["JavaScript and TypeScript", "JavaScript language fundamentals", "Asynchronous programming and browser APIs", "TypeScript for reliable applications"],
      ["Frontend Applications", "React components and state", "Routing, forms, and data fetching", "Performance and frontend architecture"],
      ["Backend and APIs", "Node.js services and HTTP", "REST API design and validation", "Authentication, authorization, and errors"],
      ["Data Engineering", "Relational modelling and SQL", "PostgreSQL transactions and indexes", "Migrations, caching, and file storage"],
      ["Quality and Security", "Unit, integration, and end-to-end tests", "Web security and privacy", "Observability and performance testing"],
      ["Delivery and Capstone", "Containers, CI/CD, and cloud deployment", "Agile teamwork and code review", "Production full-stack capstone"],
    ],
  },
  {
    title: "Digital Marketing", slug: "digital-marketing", weeks: 12,
    description: "Plan, execute, and measure customer-focused digital campaigns across content, search, social, paid media, email, ecommerce, and analytics.",
    modules: [
      ["Marketing Foundations", "Customer journeys and the marketing funnel", "Audience research and personas", "Objectives, positioning, and channel strategy"],
      ["Content and Brand", "Content strategy and editorial planning", "Copywriting and creative briefs", "Responsible AI-assisted content workflows"],
      ["Search", "Keyword research and search intent", "On-page and technical SEO", "Search ads and landing pages"],
      ["Social and Paid Media", "Platform strategy and community", "Campaign structure and creative testing", "Media planning, bidding, and budgets"],
      ["Email and Lifecycle", "List growth, consent, and segmentation", "Campaigns and automated journeys", "Deliverability, testing, and optimisation"],
      ["Analytics and Capstone", "GA4 measurement plans and attribution", "Dashboards, experiments, and reporting", "Integrated campaign capstone"],
    ],
  },
  {
    title: "Management Consulting", slug: "management-consulting", weeks: 25,
    description: "Structured consulting practice spanning problem definition, research, analysis, financial modelling, executive communication, client delivery, and implementation.",
    modules: [
      ["Consulting Foundations", "Engagement lifecycle and professional standards", "Client context and stakeholder mapping", "Scoping, workplans, and governance"],
      ["Structured Problem Solving", "Issue trees and MECE thinking", "Hypotheses and prioritised analysis", "Root causes and decision criteria"],
      ["Research and Evidence", "Secondary research and source quality", "Interviews, surveys, and workshops", "Market sizing and benchmarking"],
      ["Business Analysis", "Process and operating-model analysis", "Customer, competitor, and capability analysis", "Synthesis and insight generation"],
      ["Financial Analysis", "Financial statements and business drivers", "Unit economics and scenario models", "Business cases and valuation fundamentals"],
      ["Strategy and Operations", "Growth and portfolio choices", "Organisation and operating model design", "Digital transformation and performance improvement"],
      ["Communication", "Pyramid principle and storylines", "Executive slides and data visualisation", "Facilitation, influence, and difficult conversations"],
      ["Implementation Capstone", "Recommendations and implementation roadmap", "Benefits, risks, and change management", "Board presentation and client handover"],
    ],
  },
  {
    title: "AI & Machine Learning", slug: "ai-machine-learning", weeks: 24,
    description: "Practical AI and machine learning from Python and data preparation through supervised learning, neural networks, generative AI, responsible evaluation, and MLOps.",
    modules: [
      ["Python and Mathematical Foundations", "Python for data work", "Linear algebra, probability, and statistics", "Optimisation and gradient descent"],
      ["Data for Machine Learning", "Data collection and problem framing", "Cleaning, exploration, and visualisation", "Features, splits, leakage, and pipelines"],
      ["Supervised Learning", "Linear and logistic regression", "Trees, ensembles, and baselines", "Classification metrics and model selection"],
      ["Unsupervised Learning", "Clustering and dimensionality reduction", "Anomaly detection", "Embeddings and similarity search"],
      ["Deep Learning", "Neural networks and backpropagation", "Computer vision foundations", "Sequence models and attention"],
      ["Generative AI", "Transformers and large language models", "Prompting, retrieval, and evaluation", "Building safe AI-assisted applications"],
      ["Responsible and Production ML", "Fairness, privacy, and explainability", "Experiment tracking and reproducibility", "Deployment, monitoring, drift, and retraining"],
      ["AI/ML Capstone", "Frame a valuable ML problem", "Train and evaluate a reproducible solution", "Deploy, monitor, and present the system"],
    ],
  },
];

const bookProfiles = {
  "ui-ux-design": {
    learner: "an early-career interface designer",
    caseStudy: "a mobile onboarding flow for a community banking application",
    tools: "research notes, journey maps, wireframes, Figma components, prototypes, and usability evidence",
    standard: "clear user value, inclusive access, consistent interaction, and evidence-based decisions",
  },
  "product-design": {
    learner: "a product designer working with product and engineering partners",
    caseStudy: "an appointment-booking product for a growing neighbourhood clinic",
    tools: "opportunity maps, product principles, service blueprints, prototypes, metrics, and experiment plans",
    standard: "customer value, business viability, technical feasibility, and measurable outcomes",
  },
  "d2c-mentorship": {
    learner: "a founder building a direct-to-consumer brand",
    caseStudy: "a sustainable personal-care brand preparing to launch its first three products",
    tools: "customer interviews, unit-economics models, storefront plans, campaign briefs, lifecycle flows, and operating dashboards",
    standard: "profitable growth, honest positioning, dependable fulfilment, and long-term customer trust",
  },
  "full-stack-development": {
    learner: "a junior full-stack developer",
    caseStudy: "a secure project-tracking application used by students and mentors",
    tools: "Git, semantic HTML, CSS, TypeScript, React, Node.js, PostgreSQL, tests, and deployment pipelines",
    standard: "correctness, accessibility, security, maintainability, performance, and observable production behaviour",
  },
  "digital-marketing": {
    learner: "a digital marketer responsible for accountable growth",
    caseStudy: "the launch of a subscription-based healthy snack service",
    tools: "audience research, content calendars, search plans, campaign structures, lifecycle journeys, and analytics reports",
    standard: "customer relevance, consent, truthful communication, measurable performance, and continuous improvement",
  },
  "management-consulting": {
    learner: "a consulting analyst supporting a client engagement",
    caseStudy: "a regional retailer whose revenue is growing while operating profit is falling",
    tools: "issue trees, interview guides, research logs, financial models, executive storylines, and implementation roadmaps",
    standard: "structured reasoning, reliable evidence, transparent assumptions, practical recommendations, and client ownership",
  },
  "ai-machine-learning": {
    learner: "an applied machine-learning practitioner",
    caseStudy: "a customer-retention model for a subscription service with an auditable prediction workflow",
    tools: "Python, notebooks, versioned datasets, reproducible pipelines, evaluation reports, model cards, APIs, and monitoring dashboards",
    standard: "valid problem framing, reproducibility, appropriate evaluation, responsible use, reliability, and production monitoring",
  },
};

const moduleGuides = {
  "Design Foundations": "Design is a disciplined way to reduce uncertainty, not decoration. Students learn to move between divergent exploration and convergent decisions, use hierarchy and composition to communicate, critique work against objectives, and recognise ethical consequences such as exclusion, manipulation, and privacy harm.",
  "User Research": "Research replaces assumptions with evidence. Students learn to write answerable research questions, recruit relevant participants, choose methods for the decision at hand, ask neutral questions, record observations, separate evidence from interpretation, and synthesise patterns without inventing fictional certainty.",
  "Information Architecture": "Information architecture makes content findable and understandable. Students learn to inventory content, identify user mental models, test groupings through card sorting, name categories in the language of users, design navigation, and express task paths that include alternate routes and recovery states.",
  "Interaction Design": "Interaction design defines how a product responds over time. Students move from low-cost sketches to explicit flows, specify default, loading, empty, success, and error states, apply familiar patterns deliberately, and adapt behaviour across input methods, screen sizes, and motion preferences.",
  "UI Systems": "A user interface system turns visual decisions into reusable rules. Students work with typography, colour, spacing, grids, components, variants, and design tokens; then document when each element should be used so teams can create consistent experiences without copying screens blindly.",
  "Prototyping and Validation": "A prototype is an instrument for answering a question. Students select only the fidelity needed, define realistic tasks, facilitate sessions without coaching participants, capture observable evidence, distinguish severe usability failures from preferences, and iterate according to impact and confidence.",
  "Inclusive Product Experiences": "Inclusive design begins at the first decision. Students apply perceivable, operable, understandable, and robust principles; write plain, actionable content; prevent and recover from errors; and verify experiences with keyboard, screen-reader, zoom, contrast, responsive, and low-bandwidth checks.",
  "Portfolio Capstone": "A strong case study shows reasoning rather than a gallery of polished screens. Students frame the problem and constraints, define evidence and measures, show alternatives and trade-offs, document validation and change, prepare implementable handoff, and present the work as a coherent professional story.",
  "Product Thinking": "Product thinking connects a meaningful customer problem to an outcome the organisation can sustain. Students distinguish outputs from outcomes, inspect the market and alternatives, state product principles that guide trade-offs, and treat design choices as hypotheses rather than personal preferences.",
  "Discovery": "Discovery identifies which problem deserves investment. Students map assumptions by risk, create focused research questions, use interviews to understand situations and desired progress, and turn evidence into opportunities and a precise problem statement without prematurely prescribing a feature.",
  "Product Strategy": "Strategy is a set of choices about where to play and how to win. Students define a differentiated value proposition, choose a small set of outcome and guardrail metrics, sequence learning on a roadmap, and prioritise opportunities using evidence, effort, risk, and strategic fit.",
  "Experience Architecture": "Experience architecture connects front-stage user actions with content, rules, people, and systems behind them. Students map journeys and service dependencies, design information and task flows, and specify edge cases so a product remains coherent beyond its happy path.",
  "Prototyping": "Product prototypes make alternative solutions comparable before expensive implementation. Students generate multiple concepts, critique them against agreed principles, build realistic interactive flows, observe users completing representative tasks, and revise the product hypothesis from the evidence.",
  "Design Systems": "A design system is a shared product language, not merely a component gallery. Students establish foundations and tokens, design accessible components with documented behaviour, and create governance that balances consistency with legitimate product needs and controlled contribution.",
  "Delivery and Experimentation": "Delivery turns intent into a reliable product and evidence. Students work with engineers on specifications and acceptance criteria, choose experiments that can test causal questions, interpret behavioural data with qualitative evidence, and plan launch, monitoring, and follow-up decisions.",
  "Product Design Capstone": "The capstone integrates discovery, strategy, design, validation, and communication. Students select a measurable opportunity, create and test a coherent solution, document how evidence changed the work, and present a decision-ready case to product, design, and engineering stakeholders.",
  "D2C Fundamentals": "Direct-to-consumer businesses own the customer relationship and therefore also own acquisition, merchandising, fulfilment, service, and retention. Students compare channel models, analyse category structure and competitors, and build a scorecard that makes commercial goals and constraints explicit.",
  "Customer and Brand": "A brand becomes useful when a specific customer recognises a relevant promise. Students research behaviour and unmet needs, define an ideal customer without stereotypes, write a differentiated positioning statement, express a credible story, and assemble an offer that solves a complete customer problem.",
  "Economics and Pricing": "Revenue is not the same as profitable growth. Students calculate contribution margin after product, payment, fulfilment, returns, and acquisition costs; connect customer acquisition cost to order value, repeat rate, lifetime value, and payback; then design prices and bundles that protect trust and margin.",
  "Storefront and Conversion": "A storefront must help a qualified visitor understand, trust, choose, and complete a purchase. Students organise merchandising, write evidence-rich product pages, reduce checkout anxiety, and use behavioural and qualitative research to diagnose conversion problems before proposing tests.",
  "Growth Channels": "Growth comes from a portfolio of channels rather than dependence on a single algorithm. Students design organic content, creator relationships, paid-media tests, search coverage, partnerships, and referral loops around one customer promise and a disciplined learning agenda.",
  "Lifecycle and Retention": "Retention begins with the product promise and post-purchase experience. Students create consent-based email and SMS journeys, segment messages by customer context, design loyalty and subscription mechanics carefully, and use cohort behaviour to improve repeat purchase without manufactured urgency.",
  "Operations": "Operations deliver the promise made by marketing. Students forecast demand, set reorder logic and safety stock, compare fulfilment options, design transparent returns and support, manage vendors and compliance, and establish recurring operating reviews before scale magnifies weak processes.",
  "Scale Plan": "Scaling means repeating a healthy system, not multiplying spend. Students build a weekly performance review, decide when to add retail or marketplace channels, prevent destructive channel conflict, and turn evidence into a focused ninety-day plan with owners, budgets, milestones, and stop conditions.",
  "Developer Foundations": "Professional development starts with understanding the environment in which software runs. Students navigate files and processes, explain the browser-server request cycle, create small Git commits, collaborate through branches and reviews, and debug by forming and testing hypotheses instead of changing code randomly.",
  "Web Foundations": "The web is built on documents, styles, and progressively enhanced behaviour. Students use semantic HTML to express meaning, CSS layout to adapt across devices, and accessibility practices to ensure the interface works with keyboards, assistive technology, zoom, and varied user preferences.",
  "JavaScript and TypeScript": "JavaScript provides behaviour while TypeScript makes important assumptions visible. Students work with values, functions, collections, modules, asynchronous operations, browser APIs, and explicit types, learning to validate external data rather than confusing static types with runtime safety.",
  "Frontend Applications": "A frontend application should make state and data flow understandable. Students compose React interfaces, decide where state belongs, design routes and forms, handle loading and failure, fetch and cache remote data, and measure performance before applying optimisation.",
  "Backend and APIs": "A backend enforces rules at trust boundaries. Students build HTTP services, model resources and status codes, validate every untrusted input, authenticate identity, authorise each operation, return safe errors, and keep domain logic separate from transport and persistence concerns.",
  "Data Engineering": "Relational databases protect meaning through schema, keys, constraints, and transactions. Students normalise data where appropriate, write joins and aggregates, inspect query plans, add purposeful indexes, evolve schemas through migrations, and use caching and object storage without weakening consistency.",
  "Quality and Security": "Quality is designed into the delivery system. Students choose unit, integration, and end-to-end tests by risk; defend common web trust boundaries; protect secrets and personal data; and use logs, metrics, traces, and performance tests to understand failures in production.",
  "Delivery and Capstone": "Delivery makes a tested application repeatable in another environment. Students package services, automate build and deployment checks, collaborate through review and small releases, and produce a secure full-stack capstone with documentation, monitoring, rollback thinking, and a clear demonstration.",
  "Marketing Foundations": "Digital marketing connects a defined audience and value proposition to measurable movement through a customer journey. Students map the funnel without treating it as perfectly linear, research real audience behaviour, and convert business objectives into channel roles, measures, and guardrails.",
  "Content and Brand": "Content earns attention by being useful, recognisable, and consistent. Students design an editorial system, write clear copy from a customer insight, translate strategy into a creative brief, and use AI as an assisted drafting tool while retaining fact-checking, originality, disclosure, and human judgement.",
  "Search": "Search marketing responds to expressed intent. Students group keywords by the job a searcher is trying to complete, improve pages for relevance and technical access, design paid-search structure, and align each advertisement and landing page with the same promise and measurable action.",
  "Social and Paid Media": "Social channels combine community behaviour with paid distribution. Students choose platforms by audience and objective, design a sustainable publishing and response practice, structure campaigns and creative tests, and manage bids and budgets against incremental business outcomes rather than vanity metrics.",
  "Email and Lifecycle": "Lifecycle marketing uses permission and customer context to improve the relationship over time. Students earn consent, segment responsibly, design campaigns and triggered journeys, protect deliverability, and test one meaningful variable while measuring downstream value and unsubscribe signals.",
  "Analytics and Capstone": "Measurement begins before a campaign launches. Students define events and conversions from objectives, recognise attribution limits, build decision-focused dashboards, design credible experiments, and combine every channel into an integrated campaign with a learning report and next action.",
  "Consulting Foundations": "A consulting engagement is a temporary system for helping a client make and implement a decision. Students clarify the decision, stakeholders, scope, deliverables, governance, and professional obligations; then build a workplan that connects activities to evidence and milestones.",
  "Structured Problem Solving": "Complex problems become manageable when they are decomposed without losing the whole. Students create issue trees that are collectively sufficient and non-overlapping where practical, form falsifiable hypotheses, prioritise analysis by impact and uncertainty, and connect root causes to decision criteria.",
  "Research and Evidence": "Consulting evidence must be traceable and fit for the claim. Students assess source quality, conduct interviews and workshops without leading participants, triangulate findings, estimate market size from explicit assumptions, and benchmark comparable organisations without hiding important differences.",
  "Business Analysis": "Business analysis links observed performance to processes, customers, competitors, and capabilities. Students map current operations, locate constraints and hand-off failures, examine customer economics and competitive alternatives, and synthesise data into insights that explain why the result occurs.",
  "Financial Analysis": "Financial models translate operational assumptions into consequences. Students read the income statement, balance sheet, and cash-flow statement together; model unit economics and scenarios; construct a transparent business case; and use valuation only with assumptions and sensitivity clearly exposed.",
  "Strategy and Operations": "Strategy chooses a direction while operations make it executable. Students evaluate growth choices and portfolio roles, design decision rights and operating models, diagnose performance constraints, and approach digital transformation as coordinated change in process, capability, data, technology, and behaviour.",
  "Communication": "Executive communication starts with the decision, not the data dump. Students organise a top-down storyline, build slides where titles carry the message and evidence supports it, visualise comparisons honestly, and facilitate conversations that surface disagreement and create commitment.",
  "Implementation Capstone": "Recommendations create value only when adopted and executed. Students convert analysis into sequenced initiatives, assign owners and milestones, estimate benefits and risks, plan stakeholder and behaviour change, and deliver a board-level recommendation with a practical handover and measurement cadence.",
  "Python and Mathematical Foundations": "Applied machine learning requires fluency in data manipulation and the mathematics behind optimisation and uncertainty. Students write clear Python, reason with vectors and matrices, interpret probability and descriptive statistics, and understand how gradients update parameters to reduce a defined loss.",
  "Data for Machine Learning": "The model begins with the problem and the data-generating process. Students define the prediction target and unit of observation, inspect provenance and quality, clean and visualise data, construct features, split data without leakage, and package transformations into reproducible pipelines.",
  "Supervised Learning": "Supervised learning estimates a mapping from labelled examples. Students establish simple baselines, fit regression and classification models, use trees and ensembles when relationships are nonlinear, and select thresholds and models using metrics tied to the cost of real errors.",
  "Unsupervised Learning": "Unsupervised methods reveal useful structure without a supplied target. Students compare clustering and dimensionality-reduction techniques, detect unusual observations carefully, create embeddings for semantic comparison, and validate whether discovered patterns are stable and meaningful for the intended decision.",
  "Deep Learning": "Deep networks learn layered representations through forward computation and backpropagation. Students understand activations, losses, regularisation, and optimisation; then apply convolutional and attention-based ideas while controlling data quality, overfitting, compute cost, and evaluation error.",
  "Generative AI": "Generative systems predict plausible outputs rather than verified truth. Students understand tokens, embeddings, attention, and transformers; design prompts and retrieval with evaluation datasets; and build applications that constrain sensitive actions, cite sources, handle uncertainty, and preserve human oversight.",
  "Responsible and Production ML": "Production ML is a monitored sociotechnical system. Students examine fairness, privacy, and explanation needs; track data, code, parameters, and experiments; deploy repeatable inference; and monitor service health, data drift, prediction quality, and conditions that should trigger review or retraining.",
  "AI/ML Capstone": "The capstone proves that an ML system solves a valid problem responsibly. Students document the decision and baseline, create a reproducible training and evaluation pipeline, deploy a small inference service, define monitoring and rollback criteria, and present limitations through a model card and live demonstration.",
};

function chapter(course, moduleTitle, lessonTitle, moduleIndex, lessonIndex) {
  const profile = bookProfiles[course.slug];
  const explanation = moduleGuides[moduleTitle];
  if (!profile || !explanation) throw new Error(`Missing teaching guide for ${course.slug}/${moduleTitle}`);
  const chapterNumber = moduleIndex * 3 + lessonIndex + 1;
  const action = lessonIndex === 0 ? "explain the foundation and identify the decision it supports"
    : lessonIndex === 1 ? "apply the method step by step and document the evidence"
    : "produce a reviewable deliverable, test it, and improve it from feedback";
  return `# Chapter ${chapterNumber}: ${lessonTitle}

> **Course:** ${course.title}  
> **Module:** ${moduleIndex + 1}. ${moduleTitle}  
> **Study time:** 120 minutes

## Why this lesson matters

As ${profile.learner}, you will repeatedly make decisions about **${lessonTitle.toLowerCase()}**. The goal is not to memorise terminology. The goal is to make a sound decision, show the reasoning behind it, and produce work that another person can inspect and improve.

${explanation}

Throughout this chapter we will use **${profile.caseStudy}** as a continuing worked case. The professional standard is ${profile.standard}.

## Learning outcomes

By the end of this lesson, you will be able to:

- explain ${lessonTitle.toLowerCase()} in your own words;
- identify when this method is useful and when it is not;
- ${action};
- use ${profile.tools} to make the work visible;
- review the result against evidence instead of personal preference.

## The core idea

**${lessonTitle}** should be treated as a decision-making practice. Start by naming the decision that must be made and the people affected by it. Collect only the evidence needed for that decision. Make assumptions explicit, because a hidden assumption cannot be tested. Produce the smallest clear artefact that communicates the result, then check it against the original objective and real constraints.

A weak approach starts with a favourite tool or a polished deliverable. A strong approach starts with the question, preserves the chain from evidence to conclusion, and records what remains uncertain. This distinction matters: professional work is not valuable because it looks complete; it is valuable because it helps a team act with greater confidence.

## Instructor walkthrough

1. **Frame the decision.** Write one sentence: “We need to decide ___ so that ___.” Name the user or stakeholder, the desired outcome, and the time or resource constraint.
2. **List current evidence.** Separate observed facts, calculated measures, stakeholder statements, and assumptions. Do not place them in one undifferentiated list.
3. **Apply ${lessonTitle.toLowerCase()}.** Work from broad possibilities toward a justified choice. Record rejected alternatives and the reason for rejection.
4. **Create the artefact.** Use the simplest appropriate format from ${profile.tools}. Label the owner, version, date, sources, and unresolved questions.
5. **Validate.** Ask whether the artefact answers the decision, represents affected people fairly, exposes risk, and can be acted on by the next person in the workflow.

## Worked example

For ${profile.caseStudy}, the team first writes the decision and success measure before producing anything. They gather a small, relevant evidence set, mark uncertain claims, and compare at least two alternatives. The first draft is reviewed against ${profile.standard}. Feedback that is supported by evidence changes the work; unsupported preference is recorded but does not automatically control the decision.

The final artefact contains a short conclusion, the evidence behind it, the chosen direction, one rejected direction, known risks, and the next validation step. Notice that the deliverable is useful even when uncertainty remains, because the uncertainty is visible and attached to an action.

## Guided classroom practice

Work in groups of three. Assign one learner as the practitioner, one as the stakeholder, and one as the reviewer.

1. Frame the decision for the worked case in one sentence.
2. Write three facts and three assumptions. The reviewer must challenge any item placed in the wrong group.
3. Produce a first-pass artefact for **${lessonTitle}** in twenty-five minutes.
4. Review it using the professional standard above.
5. Revise one important decision and write a two-sentence explanation of what changed and why.

## Individual assignment

Create a concise professional deliverable that demonstrates **${lessonTitle.toLowerCase()}** for either the continuing case or a teacher-approved project.

Your submission must include:

- the decision and intended outcome;
- the affected user or stakeholder;
- evidence and sources, clearly separated from assumptions;
- the completed artefact;
- one alternative you considered;
- one risk or limitation;
- the next validation or implementation step;
- a 150-word reflection explaining your most important judgement.

## Submission checklist

- [ ] The objective is specific and measurable.
- [ ] Evidence can be traced to a source or observation.
- [ ] Assumptions are labelled rather than presented as facts.
- [ ] The artefact is readable without a verbal explanation.
- [ ] Accessibility, ethics, privacy, and operational constraints were considered where relevant.
- [ ] The conclusion follows from the evidence.
- [ ] The next action has an owner and a reason.

## Knowledge check

1. What decision does ${lessonTitle.toLowerCase()} help a team make?
2. Which part of your work is evidence, and which part is interpretation?
3. What could make the chosen method misleading?
4. How would you validate the result before increasing time or money invested?
5. What would a colleague need in order to continue your work correctly?

## Evaluation rubric

- **Understanding — 25%:** concepts are explained accurately and in the learner’s own words.
- **Method — 25%:** the process is logical, complete, and appropriate to the decision.
- **Evidence — 20%:** claims are supported and uncertainty is visible.
- **Deliverable — 20%:** the artefact is clear, usable, and professionally formatted.
- **Reflection — 10%:** trade-offs, limitations, and next steps are thoughtful and specific.

## Chapter recap

${lessonTitle} is not a box to tick. It is a way to move from a defined question to an evidence-backed action. Keep the decision visible, separate facts from assumptions, produce only what the decision needs, and validate before treating the work as finished.
`;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Supabase repository credentials are missing.");
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const library = db.schema("library");

const { data: existing, error: readError } = await library.from("course_templates").select("id,title,slug,deleted_at").is("deleted_at", null).order("title");
if (readError) throw readError;
const ids = existing.map(row => row.id);
const { data: currentModules, error: modulesReadError } = ids.length
  ? await library.from("module_templates").select("id,course_template_id,title,position,description").in("course_template_id", ids).is("deleted_at", null)
  : { data: [], error: null };
if (modulesReadError) throw modulesReadError;
const moduleIds = currentModules.map(row => row.id);
const { data: currentLessons, error: lessonsReadError } = moduleIds.length
  ? await library.from("lesson_templates").select("id,module_template_id,title,position,content_json").in("module_template_id", moduleIds).is("deleted_at", null)
  : { data: [], error: null };
if (lessonsReadError) throw lessonsReadError;
const current = existing.map(course => {
  const modules = currentModules.filter(module => module.course_template_id === course.id);
  const moduleSet = new Set(modules.map(module => module.id));
  return { title: course.title, slug: course.slug, modules: modules.length, lessons: currentLessons.filter(lesson => moduleSet.has(lesson.module_template_id)).length };
});
console.log(JSON.stringify({ current, replacement: courses.map(({ title, slug, weeks, modules }) => ({ title, slug, weeks, modules: modules.length, lessons: modules.length * 3 })) }, null, 2));
if (process.argv.includes("--verify-content")) {
  const bodies = currentLessons.map(row => row.content_json?.body || row.content_json?.text || "");
  const requiredSections = ["## Why this lesson matters", "## The core idea", "## Instructor walkthrough", "## Worked example", "## Guided classroom practice", "## Individual assignment", "## Evaluation rubric", "## Chapter recap"];
  const invalid = currentLessons.filter((row, index) => bodies[index].length < 4_000 || requiredSections.some(section => !bodies[index].includes(section)));
  const placeholderModules = currentModules.filter(row => !row.description || row.description.endsWith("knowledge, applied practice, and review."));
  const report = {
    courses: existing.length,
    modules: currentModules.length,
    lessons: currentLessons.length,
    minimumChapterCharacters: Math.min(...bodies.map(body => body.length)),
    maximumChapterCharacters: Math.max(...bodies.map(body => body.length)),
    invalidChapters: invalid.map(row => row.title),
    placeholderModules: placeholderModules.map(row => row.title),
  };
  console.log(JSON.stringify(report, null, 2));
  if (report.courses !== 7 || report.modules !== 54 || report.lessons !== 162 || invalid.length || placeholderModules.length) process.exit(1);
  process.exit(0);
}
if (process.argv.includes("--upgrade-content")) {
  let updated = 0;
  for (const course of courses) {
    const courseRow = existing.find(row => row.slug === course.slug);
    if (!courseRow) throw new Error(`Active course template not found: ${course.slug}`);
    const modules = currentModules.filter(row => row.course_template_id === courseRow.id).sort((a, b) => a.position - b.position);
    if (modules.length !== course.modules.length) throw new Error(`Module count mismatch for ${course.slug}`);
    for (const [moduleIndex, [moduleTitle, ...lessonTitles]] of course.modules.entries()) {
      const moduleRow = modules[moduleIndex];
      if (moduleRow.title !== moduleTitle) throw new Error(`Module order mismatch for ${course.slug}: expected ${moduleTitle}, found ${moduleRow.title}`);
      const { error: moduleUpdateError } = await library.from("module_templates").update({ description: moduleGuides[moduleTitle] }).eq("id", moduleRow.id);
      if (moduleUpdateError) throw moduleUpdateError;
      const lessons = currentLessons.filter(row => row.module_template_id === moduleRow.id).sort((a, b) => a.position - b.position);
      if (lessons.length !== lessonTitles.length) throw new Error(`Lesson count mismatch for ${course.slug}/${moduleTitle}`);
      for (const [lessonIndex, lessonTitle] of lessonTitles.entries()) {
        const lesson = lessons[lessonIndex];
        if (lesson.title !== lessonTitle) throw new Error(`Lesson order mismatch for ${course.slug}/${moduleTitle}`);
        const body = chapter(course, moduleTitle, lessonTitle, moduleIndex, lessonIndex);
        if (body.length < 4_000) throw new Error(`Generated chapter is too short: ${course.slug}/${lessonTitle}`);
        const { error: lessonUpdateError } = await library.from("lesson_templates").update({
          lesson_type_code: "text", content_json: { text: body, body }, duration: 120,
        }).eq("id", lesson.id);
        if (lessonUpdateError) throw lessonUpdateError;
        updated += 1;
      }
    }
  }
  console.log(`Upgraded ${updated} lessons to book-style teaching chapters.`);
  process.exit(0);
}
if (!process.argv.includes("--apply")) process.exit(0);

const now = new Date().toISOString();
const oldIds = existing.map(row => row.id);
const insertedIds = [];
try {
  if (oldIds.length) {
    const { error } = await library.from("course_templates").update({ deleted_at: now, updated_at: now }).in("id", oldIds);
    if (error) throw error;
  }
  for (const course of courses) {
    const { data: created, error: courseError } = await library.from("course_templates").insert({
      title: course.title, slug: course.slug, description: course.description,
      duration_minutes: course.weeks * 600, course_type_code: "hybrid", enrollment_mode: "open",
      version: 1, is_latest: true, is_published: true,
    }).select("id").single();
    if (courseError) throw courseError;
    insertedIds.push(created.id);
    for (const [moduleIndex, [moduleTitle, ...lessons]] of course.modules.entries()) {
      const { data: module, error: moduleError } = await library.from("module_templates").insert({
        course_template_id: created.id, title: moduleTitle,
        description: `${moduleTitle} knowledge, applied practice, and review.`, position: moduleIndex + 1,
      }).select("id").single();
      if (moduleError) throw moduleError;
      const rows = lessons.map((title, lessonIndex) => ({
        module_template_id: module.id, title, lesson_type_code: "text", position: lessonIndex + 1,
        duration: 120, is_preview: moduleIndex === 0 && lessonIndex === 0,
        content_json: { text: chapter(course, moduleTitle, title, moduleIndex, lessonIndex), body: chapter(course, moduleTitle, title, moduleIndex, lessonIndex) },
      }));
      const { error: lessonsError } = await library.from("lesson_templates").insert(rows);
      if (lessonsError) throw lessonsError;
    }
  }
} catch (error) {
  if (insertedIds.length) await library.from("course_templates").delete().in("id", insertedIds);
  if (oldIds.length) await library.from("course_templates").update({ deleted_at: null }).in("id", oldIds);
  throw error;
}

console.log(`Seeded ${courses.length} published course templates; ${oldIds.length} previous templates were soft-deleted.`);
