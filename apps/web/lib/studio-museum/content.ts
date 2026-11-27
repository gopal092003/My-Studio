export type Exhibition = {
  id: string;
  number: string;
  title: string;
  shortTitle: string;
  marker: string;
  description: string;
  position: [number, number, number];
  rotationY: number;
};

export const museumIntroduction = {
  title: "THE PERSONAL MUSEUM",
  subtitle: "A journey through my work, experiences, interests and ideas.",
  greeting: "Hello, I'm [Your Name]. Welcome to my world.",
  description:
    "Explore the different dimensions of my journey — from education and professional work to technology, creativity and personal interests.",
};

export const aboutMeExhibition: Exhibition = {
  id: "about-me",
  number: "00",
  title: "About Me",
  shortTitle: "About",
  marker: "00 / THE CURATOR",
  description: `${museumIntroduction.greeting} ${museumIntroduction.description}`,
  position: [0, 0, -39.45],
  rotationY: 0,
};

export const exhibitions: Exhibition[] = [
  {
    id: "education",
    number: "01",
    title: "Education Hall",
    shortTitle: "Learning",
    marker: "01 / EDUCATION",
    description: "A collection of formative studies, lessons, and the questions that stayed with me.",
    position: [-27.55, 0, -26],
    rotationY: Math.PI / 2,
  },
  {
    id: "professional-journey",
    number: "02",
    title: "Professional Gallery",
    shortTitle: "Work",
    marker: "02 / PROFESSIONAL",
    description: "The projects, collaborators, and turning points that have shaped my work.",
    position: [-27.55, 0, -13],
    rotationY: Math.PI / 2,
  },
  {
    id: "technology-innovation",
    number: "03",
    title: "Technology & Innovation Lab",
    shortTitle: "Technology",
    marker: "03 / TECHNOLOGY",
    description: "Tools and ideas that open new ways to make, solve, and imagine.",
    position: [-27.55, 0, 0],
    rotationY: Math.PI / 2,
  },
  {
    id: "research",
    number: "04",
    title: "Research Gallery",
    shortTitle: "Inquiry",
    marker: "04 / RESEARCH",
    description: "Questions explored, sources gathered, and insights still taking shape.",
    position: [-27.55, 0, 13],
    rotationY: Math.PI / 2,
  },
  {
    id: "creative-pursuits",
    number: "05",
    title: "Creative Gallery",
    shortTitle: "Making",
    marker: "05 / CREATIVE",
    description: "Experiments and finished work across the things I love to create.",
    position: [-27.55, 0, 26],
    rotationY: Math.PI / 2,
  },
  {
    id: "hobbies-interests",
    number: "06",
    title: "Exploration Zone",
    shortTitle: "Curiosity",
    marker: "06 / INTERESTS",
    description: "The pursuits, hobbies, and small obsessions that make the world feel wider.",
    position: [27.55, 0, -19.5],
    rotationY: -Math.PI / 2,
  },
  {
    id: "achievements-milestones",
    number: "07",
    title: "Milestone Gallery",
    shortTitle: "Milestones",
    marker: "07 / MILESTONES",
    description: "Moments worth remembering, each one part of a longer journey.",
    position: [27.55, 0, -6.5],
    rotationY: -Math.PI / 2,
  },
  {
    id: "personal-archives",
    number: "08",
    title: "Personal Archives",
    shortTitle: "Archive",
    marker: "08 / MEMORY",
    description: "Notes, artifacts, and fragments preserved along the way.",
    position: [27.55, 0, 6.5],
    rotationY: -Math.PI / 2,
  },
  {
    id: "future-aspirations",
    number: "09",
    title: "Future Wing",
    shortTitle: "Horizons",
    marker: "09 / FUTURE",
    description: "A look toward the ideas, places, and possibilities still ahead.",
    position: [27.55, 0, 19.5],
    rotationY: -Math.PI / 2,
  },
];

export const allExhibitions = [aboutMeExhibition, ...exhibitions];
