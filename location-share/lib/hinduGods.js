export const HINDU_GODS = [
  {
    group: 'Trimurti & Consorts',
    gods: ['Brahma', 'Vishnu', 'Shiva', 'Saraswati', 'Lakshmi', 'Parvati'],
  },
  {
    group: 'Avatars of Vishnu',
    gods: ['Ram', 'Krishna', 'Narasimha', 'Vamana', 'Parashurama', 'Balarama', 'Matsya', 'Kurma', 'Varaha', 'Kalki'],
  },
  {
    group: 'Shakti / Devi Forms',
    gods: ['Durga', 'Kali', 'Radha', 'Sita', 'Gayatri', 'Annapurna', 'Chamunda', 'Santoshi Mata', 'Vaishno Devi', 'Bhavani', 'Ambika', 'Jagadamba', 'Tripura Sundari', 'Bhuvaneshvari', 'Tara Devi', 'Chinnamasta', 'Bagalamukhi', 'Dhumavati'],
  },
  {
    group: 'Ganesha & Kartikeya',
    gods: ['Ganesha', 'Kartikeya / Murugan', 'Ayyappa'],
  },
  {
    group: 'Hanuman & Associates',
    gods: ['Hanuman', 'Garuda', 'Nandi', 'Naga Devata'],
  },
  {
    group: 'Forms of Shiva',
    gods: ['Nataraja', 'Mahakaal', 'Bhairav', 'Rudra', 'Ardhanarishvara', 'Dakshinamurthy', 'Lingam', 'Pashupati', 'Sadashiva', 'Tryambakeshwar'],
  },
  {
    group: 'Surya & Navagraha',
    gods: ['Surya', 'Chandra', 'Mangal', 'Budh', 'Brihaspati', 'Shukra', 'Shani', 'Rahu', 'Ketu'],
  },
  {
    group: 'Vedic Gods',
    gods: ['Indra', 'Agni', 'Vayu', 'Varuna', 'Yama', 'Kuber', 'Brihaspati', 'Ashwini Kumaras', 'Ushas', 'Soma'],
  },
  {
    group: 'Regional & Popular',
    gods: ['Tirupati Balaji / Venkateshwara', 'Jagannath', 'Vithal / Vithoba', 'Khandoba', 'Dattatreya', 'Shirdi Sai Baba', 'Swaminarayan', 'Baba Ramdev', 'Venkateswara', 'Panduranga'],
  },
  {
    group: 'Sacred Rishis & Gurus',
    gods: ['Chanakya', 'Valmiki', 'Vyasa', 'Narada', 'Vasishtha', 'Vishwamitra', 'Agastya', 'Kapila', 'Patanjali', 'Adi Shankaracharya'],
  },
  {
    group: 'Minor Deities & Protectors',
    gods: ['Kubera', 'Kamadeva', 'Rati', 'Revanta', 'Bhumi Devi', 'Ganga Devi', 'Yamuna Devi', 'Vayu Dev', 'Pawanputra', 'Kshetrapala', 'Bhairava', 'Kalbhairava', 'Mahishasura Mardini', 'Skandamata', 'Katyayani', 'Kushmanda', 'Shailaputri', 'Brahmacharini'],
  },
];

// Flat list for simple search/filter
export const ALL_GODS = HINDU_GODS.flatMap(g => g.gods);
