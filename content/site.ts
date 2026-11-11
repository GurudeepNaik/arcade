export const site = {
  name: "Gurudeep Naik",
  title: "Senior Full Stack Engineer",
  stack: "MERN · Next.js · Python",
  url: "https://portfolio-gurudeep-naik.vercel.app",
  arcadeUrl: "https://gurudeep-arcade.vercel.app",
  tagline: "I build systems that keep business data correct.",
  intro:
    "Senior Full Stack Engineer at Kyra Technologies. For four years I've built web apps and the integrations between ERP, CRM and e-commerce systems — NetSuite, xTuple, Salesforce, Shopify — for US manufacturing and e-commerce companies.",
  availability: "Open to Senior Full Stack and Backend roles · remote or hybrid",
  location: "Bhatkal, Karnataka, India · IST (UTC+5:30)",
  email: "gurudeepnaik1999@gmail.com",
  phone: "+91 88611 28645",
  links: {
    github: "https://github.com/GurudeepNaik",
    linkedin: "https://www.linkedin.com/in/gurudeep-naik/",
    resume: "/resume/Gurudeep_Naik_Resume.pdf",
  },
};

// Every number here was measured, with its source noted next to it.
export const stats = [
  { value: "4 yrs", label: "building production systems for US companies" },
  { value: "123", label: "automated tests across 3 open-source systems" }, // 47 + 46 + 30, pytest --collect-only
  { value: "30 / 30", label: "chaos runs converged in the two-way sync" }, // erp-sync-starter seed sweep
  { value: "100%", label: "merge precision on 5 labeled dedupe datasets" }, // customer-dedupe benchmark
];

export const focus = [
  {
    title: "Integrations that don't drift",
    body: "ERP, CRM and e-commerce systems kept in step: NetSuite, xTuple, Salesforce and Shopify. Idempotent writes, retries that survive outages, and a way to prove both sides agree.",
  },
  {
    title: "Data you can trust",
    body: "Deduplication, reconciliation and production data fixes that are verified before they ship: every record accounted for, every number traceable to the query that produced it.",
  },
  {
    title: "Full stack, end to end",
    body: "React and Next.js front ends, Node.js and Python services, PostgreSQL and MongoDB, AWS and Docker — and owning production incidents from the first alert to the deployed fix.",
  },
];
