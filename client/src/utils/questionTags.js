// Question source tag formatting utilities (board / admission / college).

const BOARD_ABBRS = {
  Dhaka: 'DB', Comilla: 'CB', Rajshahi: 'RB', Jessore: 'JB', Chittagong: 'CtgB',
  Sylhet: 'SB', Barishal: 'BB', Dinajpur: 'DjB', Mymensingh: 'MB', Madrasa: 'MadB', Technical: 'TB',
};

const UNIV_ABBRS = {
  'Dhaka University': 'DU', 'Chittagong University': 'CU', 'Rajshahi University': 'RU',
  'Jahangirnagar University': 'JU', 'Agriculture (Cluster)': 'AGRI', 'GST (Cluster)': 'GST',
  'CKRUET (Cluster)': 'CKRUET', 'IBA (DU)': 'IBA',
};

const COLLEGE_ABBRS = {
  'Notre Dame College': 'NDC', 'Adamjee Cantonment College': 'ACC', 'Rajuk Uttara Model College': 'RUMC',
  'Holy Cross College': 'HCC', 'Viqarunnisa Noon School & College': 'VNSC', 'Dhaka Residential Model College': 'DRMC',
  'Dhaka College': 'DC', 'Birshreshtha Noor Mohammad Public College': 'BNMPC', 'BAF Shaheen College Dhaka': 'BSCD',
  'St. Joseph Higher Secondary School': 'SJHSS', 'Abdul Kadir Mollah City College': 'AKCC',
  'Government Hazi Mohammad Mohsin College': 'GHMMC', 'Chittagong College': 'ChC', 'Rajshahi College': 'RC',
  'Government Azizul Haque College': 'GAHC', 'Ananda Mohan College': 'AMC', 'Cumilla Victoria Government College': 'CVGC',
  'Government Brojomohun College': 'GBC', 'MC College': 'MCC', 'Government Edward College': 'GEC',
};

const autoCollegeAbbr = (name) => {
  if (!name) return '';
  const skip = new Set(['and', '&', 'of', 'the', 'al']);
  return name
    .split(/[\s.]+/)
    .filter(w => w.length > 0 && !skip.has(w.toLowerCase()))
    .map(w => w[0].toUpperCase())
    .join('');
};

const formatSessionYear = (year) => {
  if (!year) return '';
  const yearStr = String(year).trim();
  if (yearStr.includes('-') || yearStr.includes('/')) {
    const parts = yearStr.split(/[-/]/);
    return `${parts[0].trim().slice(-2)}-${parts[1].trim().slice(-2)}`;
  }
  return yearStr.slice(-2);
};

export function getTagAbbreviation(tag) {
  if (!tag) return '';
  const yearStr = tag.year ? String(tag.year).slice(-2) : '';
  if (tag.category === 'board') {
    const boardAbbr = BOARD_ABBRS[tag.board] || (tag.board ? `${tag.board.charAt(0).toUpperCase()}B` : '');
    return yearStr ? `${boardAbbr}-${yearStr}` : boardAbbr;
  } else if (tag.category === 'college') {
    const collegeAbbr = COLLEGE_ABBRS[tag.college] || autoCollegeAbbr(tag.college || '');
    return yearStr ? `${collegeAbbr}-${yearStr}` : collegeAbbr;
  }
  const univAbbr = UNIV_ABBRS[tag.university] || tag.university || '';
  const sessionYear = formatSessionYear(tag.year);
  const unit = tag.unit ? ` ${tag.unit}` : '';
  return sessionYear ? `${univAbbr}${unit} · ${sessionYear}` : `${univAbbr}${unit}`;
}

export function getTagTitle(tag) {
  if (!tag) return '';
  if (tag.category === 'board') {
    return `${tag.board} Board${tag.year ? ` - ${tag.year}` : ''}`;
  } else if (tag.category === 'college') {
    return `${tag.college}${tag.year ? ` - ${tag.year}` : ''}`;
  }
  return `${tag.university}${tag.unit ? ` (${tag.unit})` : ''}${tag.year ? ` - ${tag.year}` : ''}`;
}

// Groups a flat list of questions into qbank selections for the contest backend.
export function buildSelectionsFromQuestions(questions) {
  const groupMap = {};
  (questions || []).forEach(q => {
    const key = `${q.subject}||${q.paper}`;
    if (!groupMap[key]) {
      groupMap[key] = { subject: q.subject, paper: q.paper, questionIds: [], chapterSet: new Set() };
    }
    groupMap[key].questionIds.push(q._id);
    if (q.chapter) groupMap[key].chapterSet.add(q.chapter);
  });
  return Object.values(groupMap).map(g => ({
    subject: g.subject,
    paper: g.paper,
    questionIds: g.questionIds,
    numberOfQuestions: g.questionIds.length,
    chapters: Array.from(g.chapterSet).map(name => ({ name })),
  }));
}
