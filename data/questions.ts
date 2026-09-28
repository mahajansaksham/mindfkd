import additions from "./genre-additions.json";
import {categoryGenre} from "../lib/genres";
import { Question, Kind } from "../lib/game";
import community from "./community.json";
import foundations from "./foundations.json";
// Format: tier | category | prompt | correct answer | distractors. Stable, dated facts only.
const facts = `
1|Geography|What is the capital of France?|Paris|Rome|Madrid|Berlin
1|Science|Which planet is the largest in our solar system?|Jupiter|Earth|Mars|Venus
1|Brands|Which company introduced the iPhone?|Apple|Samsung|Sony|Nokia
1|Animals|What is the largest living animal?|Blue whale|Elephant|Giraffe|Polar bear
1|World|Which ocean is the largest?|Pacific|Atlantic|Indian|Arctic
1|Sports|In which sport do players shoot hoops?|Basketball|Football|Tennis|Golf
1|Food|Which fruit is traditionally used to make wine?|Grapes|Bananas|Pears|Peaches
1|Science|How many legs does an adult insect have?|6|4|8|10
1|General Knowledge|How many days are in a week?|7|5|6|8
1|Music|Which instrument usually has 88 keys?|Piano|Guitar|Violin|Trumpet
1|Movies & TV|What kind of animal is Simba in The Lion King?|Lion|Tiger|Bear|Wolf
1|Technology|What does a computer mouse primarily control?|Pointer|Volume|Brightness|Power
1|Numbers & Comparisons|What is 9 + 6?|15|14|16|13
1|History|Ancient Egyptian kings were called what?|Pharaohs|Emperors|Sultans|Dukes
1|Animals|Which animal is known for black-and-white stripes?|Zebra|Leopard|Lion|Hippo
1|Food|Sushi is most closely associated with which country?|Japan|Italy|Mexico|Greece
1|World|Which country is home to the Eiffel Tower?|France|Spain|Germany|Portugal
1|Science|What do humans use to breathe?|Lungs|Stomach|Kidneys|Liver
1|Sports|Which sport uses a racket and shuttlecock?|Badminton|Cricket|Rugby|Baseball
1|Brands|Which brand uses the swoosh logo?|Nike|Adidas|Puma|Reebok
1|Geography|Which is a continent?|Africa|Canada|India|Brazil
1|Music|How many strings does a standard guitar have?|6|3|4|8
2|Geography|What is the capital of Italy?|Rome|Milan|Venice|Naples
2|Science|What is the chemical formula of water?|H₂O|CO₂|O₂|NaCl
2|History|Who was the first person to walk on the Moon?|Neil Armstrong|Buzz Aldrin|Yuri Gagarin|John Glenn
2|Animals|What is a baby frog called?|Tadpole|Calf|Cub|Foal
2|Food|Guacamole is primarily made from what?|Avocado|Cucumber|Peas|Spinach
2|Movies & TV|Who plays Jack in the 1997 film Titanic?|Leonardo DiCaprio|Brad Pitt|Matt Damon|Tom Cruise
2|Music|Which band recorded Hey Jude?|The Beatles|Queen|ABBA|Oasis
2|Sports|How many players per team start on the field in association football?|11|9|10|12
2|Technology|What does the W in WWW stand for?|World|Wideband|Wireless|Window
2|World|Which language is primarily spoken in Brazil?|Portuguese|Spanish|French|Italian
2|General Knowledge|How many sides does a hexagon have?|6|5|7|8
2|Brands|Which company makes the PlayStation?|Sony|Nintendo|Microsoft|Sega
2|Science|Which gas do plants take in for photosynthesis?|Carbon dioxide|Helium|Hydrogen|Neon
2|Geography|Which country has the city of Barcelona?|Spain|Portugal|Italy|France
2|Animals|Which is a mammal?|Dolphin|Shark|Trout|Octopus
2|Food|Which country is the origin of Parmesan cheese?|Italy|France|Germany|Norway
2|History|The Colosseum was built by which civilization?|Romans|Aztecs|Vikings|Incas
2|Numbers & Comparisons|How many minutes are in two hours?|120|90|100|150
2|Sports|Which sport is played at Wimbledon?|Tennis|Golf|Cricket|Rugby
2|Music|Freddie Mercury was the lead singer of which band?|Queen|Genesis|Blur|Coldplay
2|Science|Which star is closest to Earth?|The Sun|Sirius|Polaris|Vega
2|Movies & TV|Which fictional wizard attends Hogwarts?|Harry Potter|Gandalf|Merlin|Doctor Strange
3|Geography|What is the capital of Australia?|Canberra|Sydney|Melbourne|Perth
3|Science|Which planet has the shortest year?|Mercury|Venus|Mars|Earth
3|History|In which year did World War II end?|1945|1943|1944|1946
3|Technology|Which company developed the original Android operating system before Google acquired it?|Android Inc.|IBM|Nokia|Microsoft
3|Music|Which artist released the album Thriller in 1982?|Michael Jackson|Prince|David Bowie|Stevie Wonder
3|Sports|Which country won the 2010 men's FIFA World Cup?|Spain|Netherlands|Germany|Brazil
3|Food|Saffron comes from which part of a flower?|Stigmas|Roots|Leaves|Seeds
3|Animals|Which mammal lays eggs?|Platypus|Otter|Beaver|Seal
3|World|Which currency is used in Japan?|Yen|Won|Yuan|Baht
3|Movies & TV|Who directed Jurassic Park (1993)?|Steven Spielberg|James Cameron|George Lucas|Ridley Scott
3|General Knowledge|Which chess piece moves in an L shape?|Knight|Bishop|Rook|Queen
3|Brands|Which car brand uses four interlocking rings?|Audi|BMW|Volvo|Mercedes-Benz
3|Numbers & Comparisons|What is 15% of 200?|30|15|20|40
3|Science|What element has the symbol Fe?|Iron|Fluorine|Francium|Lead
3|Geography|Which river flows through Paris?|Seine|Thames|Rhine|Danube
3|History|Who painted the Mona Lisa?|Leonardo da Vinci|Michelangelo|Raphael|Botticelli
3|Music|Which composer wrote The Four Seasons?|Vivaldi|Mozart|Bach|Beethoven
3|Food|Tofu is made from which bean?|Soybean|Chickpea|Kidney bean|Lentil
3|Animals|How many hearts does an octopus have?|3|1|2|4
3|Technology|What does PDF stand for?|Portable Document Format|Personal Data File|Public Digital Form|Printed Document File
3|Sports|In tennis, what comes after deuce if one player wins a point?|Advantage|Set|Match|Love
3|World|Which city hosted the 2016 Summer Olympics?|Rio de Janeiro|Tokyo|London|Beijing
4|Geography|Which country has the longest coastline?|Canada|Russia|Australia|Indonesia
4|Science|Which element has atomic number 6?|Carbon|Oxygen|Nitrogen|Boron
4|History|In which year did the Berlin Wall fall?|1989|1987|1991|1993
4|Movies & TV|Which film won Best Picture at the 2020 Oscars?|Parasite|1917|Joker|Once Upon a Time in Hollywood
4|Music|Which band released OK Computer?|Radiohead|Oasis|Blur|Muse
4|Sports|A marathon is how many kilometres long?|42.195|40.000|41.500|44.000
4|Food|Which grain is traditionally used in risotto?|Rice|Barley|Wheat|Millet
4|Animals|A group of lions is called what?|Pride|Pod|School|Colony
4|Technology|Which language runs natively in web browsers?|JavaScript|Python|C++|Ruby
4|World|Which country was formerly called Ceylon?|Sri Lanka|Myanmar|Thailand|Cambodia
4|General Knowledge|Who wrote Nineteen Eighty-Four?|George Orwell|Aldous Huxley|Ray Bradbury|H. G. Wells
4|Numbers & Comparisons|What is the square root of 144?|12|11|13|14
4|Brands|Which country is LEGO originally from?|Denmark|Sweden|Norway|Finland
4|Science|Which planet has the Great Red Spot?|Jupiter|Saturn|Neptune|Uranus
4|Geography|Which is the world's largest hot desert?|Sahara|Gobi|Arabian|Kalahari
4|History|Who was the first woman to win a Nobel Prize?|Marie Curie|Rosalind Franklin|Ada Lovelace|Dorothy Hodgkin
4|Movies & TV|Which studio created Spirited Away?|Studio Ghibli|Pixar|DreamWorks|Laika
4|Music|Which composer became deaf during his career?|Beethoven|Chopin|Haydn|Schubert
4|Sports|In cricket, how many legal deliveries make a standard over?|6|4|5|8
4|Food|Tahini is made from which seeds?|Sesame|Sunflower|Pumpkin|Flax
4|Technology|What does the S in HTTPS stand for?|Secure|Server|System|Source
4|World|Which treaty formally created the European Union?|Maastricht Treaty|Treaty of Rome|Treaty of Lisbon|Treaty of Versailles
5|Science|Which moon has a thick nitrogen-rich atmosphere?|Titan|Europa|Io|Phobos
5|History|In which year was Magna Carta first issued?|1215|1066|1415|1492
5|Geography|Which country is landlocked?|Bolivia|Ecuador|Uruguay|Colombia
5|Movies & TV|Who directed Seven Samurai?|Akira Kurosawa|Yasujirō Ozu|Hayao Miyazaki|Hirokazu Kore-eda
5|Music|Which album begins with Smells Like Teen Spirit?|Nevermind|In Utero|Ten|Dirt
5|Sports|Which country won the first men's FIFA World Cup in 1930?|Uruguay|Argentina|Brazil|Italy
5|Food|What is the main ingredient in traditional miso?|Soybeans|Peanuts|Rice noodles|Seaweed
5|Animals|Which bird can fly backwards under its own power?|Hummingbird|Eagle|Sparrow|Ostrich
5|Technology|Which computer scientist proposed the imitation game?|Alan Turing|John von Neumann|Claude Shannon|Tim Berners-Lee
5|World|Which strait separates Spain and Morocco?|Strait of Gibraltar|Strait of Hormuz|Bering Strait|Strait of Malacca
5|General Knowledge|Who wrote One Hundred Years of Solitude?|Gabriel García Márquez|Jorge Luis Borges|Pablo Neruda|Mario Vargas Llosa
5|Numbers & Comparisons|What is 2 to the power of 10?|1024|512|2048|1000
5|Brands|Which company began as a playing-card maker in 1889?|Nintendo|Sega|Sony|Atari
5|Science|What is the SI unit of electrical resistance?|Ohm|Volt|Ampere|Watt
5|History|Which empire built Machu Picchu?|Inca|Aztec|Maya|Olmec
5|Geography|Which lake is the deepest in the world?|Baikal|Tanganyika|Superior|Victoria
5|Movies & TV|Which film features the character Travis Bickle?|Taxi Driver|Raging Bull|Goodfellas|The Deer Hunter
5|Music|Which instrument did Miles Davis primarily play?|Trumpet|Saxophone|Piano|Trombone
5|Sports|What is a score of three under par on a golf hole called?|Albatross|Eagle|Birdie|Bogey
5|Food|Which country is the origin of kimchi?|Korea|Japan|Vietnam|Thailand
5|Science|What is the most abundant gas in Earth's atmosphere?|Nitrogen|Oxygen|Argon|Carbon dioxide
5|Technology|Which protocol translates domain names into IP addresses?|DNS|FTP|SMTP|SSH
6|Science|Which element has the chemical symbol W?|Tungsten|Tin|Tellurium|Titanium
6|History|Which peace settlement ended the Thirty Years' War in 1648?|Peace of Westphalia|Peace of Augsburg|Treaty of Utrecht|Treaty of Tordesillas
6|Geography|Which country contains the source of the Blue Nile at Lake Tana?|Ethiopia|Uganda|Sudan|Kenya
6|Music|Who composed The Rite of Spring?|Igor Stravinsky|Sergei Prokofiev|Dmitri Shostakovich|Sergei Rachmaninoff
6|Movies & TV|Who directed the 1927 film Metropolis?|Fritz Lang|F. W. Murnau|Sergei Eisenstein|Ernst Lubitsch
6|Sports|Which city hosted the first modern Olympic Games in 1896?|Athens|Paris|London|Rome
6|Food|Which acid gives vinegar its characteristic sour taste?|Acetic acid|Citric acid|Lactic acid|Tartaric acid
6|Animals|Which of these is a monotreme?|Echidna|Wombat|Koala|Tasmanian devil
6|Technology|What does the R in RSA encryption stand for?|Rivest|Random|Recursive|Riemann
6|World|Which country was the first to grant women the vote in national parliamentary elections, in 1893?|New Zealand|Australia|Finland|Norway
6|General Knowledge|Who wrote The Master and Margarita?|Mikhail Bulgakov|Boris Pasternak|Leo Tolstoy|Anton Chekhov
6|Numbers & Comparisons|Which is the smallest prime number greater than 100?|101|103|107|109
6|Science|What is the boundary around a black hole beyond which light cannot escape?|Event horizon|Photon belt|Singularity|Ergosphere
6|History|Which dynasty built most of the surviving Great Wall of China?|Ming|Han|Tang|Song
6|Geography|Which capital lies closest to the equator?|Quito|Lima|Bogotá|Caracas
6|Music|Which jazz musician recorded A Love Supreme?|John Coltrane|Miles Davis|Charlie Parker|Duke Ellington
6|Movies & TV|Which film won the first Academy Award for Best Animated Feature?|Shrek|Toy Story|Spirited Away|Finding Nemo
6|Sports|Which country won the 1995 Rugby World Cup?|South Africa|New Zealand|Australia|England
6|Food|Which compound is responsible for chili pepper heat?|Capsaicin|Piperine|Menthol|Eugenol
6|Technology|In computing, what is a LIFO data structure called?|Stack|Queue|Heap|Graph
6|Science|Which subatomic particle mediates the electromagnetic force?|Photon|Gluon|Neutrino|Higgs boson
6|World|Which sea has no land coastline, being bounded by currents?|Sargasso Sea|Red Sea|Baltic Sea|Black Sea
7|Science|Which law states that a gas's pressure is inversely proportional to its volume at constant temperature?|Boyle's law|Charles's law|Ohm's law|Hooke's law
7|History|The Defenestration of Prague in 1618 helped trigger which conflict?|Thirty Years' War|Seven Years' War|Hundred Years' War|War of Spanish Succession
7|Geography|Which country contains the exclave of Nakhchivan?|Azerbaijan|Armenia|Georgia|Kazakhstan
7|Music|Which composer wrote the opera Wozzeck?|Alban Berg|Anton Webern|Arnold Schoenberg|Richard Strauss
7|Movies & TV|Who directed the 1966 film Persona?|Ingmar Bergman|Federico Fellini|Andrei Tarkovsky|Jean-Luc Godard
7|Sports|Who ran the first officially recorded sub-four-minute mile?|Roger Bannister|John Landy|Sebastian Coe|Emil Zátopek
7|Food|Which microorganism is used to make traditional tempeh?|Rhizopus mold|Baker's yeast|Penicillium roqueforti|Lactobacillus bulgaricus
7|Animals|Which living animal is the closest relative of the giraffe?|Okapi|Zebra|Camel|Antelope
7|Technology|Which algorithm finds shortest paths with non-negative edge weights?|Dijkstra's algorithm|Quicksort|Kruskal's algorithm|Binary search
7|World|Which treaty divided overseas claims between Spain and Portugal in 1494?|Treaty of Tordesillas|Treaty of Utrecht|Treaty of Paris|Treaty of Zaragoza
7|General Knowledge|Who wrote the novel Things Fall Apart?|Chinua Achebe|Wole Soyinka|Ngũgĩ wa Thiong'o|Ben Okri
7|Numbers & Comparisons|How many edges does an icosahedron have?|30|20|12|60
7|Science|Which isotope is used as the standard for the unified atomic mass unit?|Carbon-12|Carbon-14|Oxygen-16|Hydrogen-1
7|History|Which Byzantine emperor commissioned the sixth-century Hagia Sophia?|Justinian I|Constantine I|Basil II|Heraclius
7|Geography|Which strait separates Tierra del Fuego from mainland South America?|Strait of Magellan|Drake Passage|Beagle Channel|Torres Strait
7|Music|Which mode is a major scale with a raised fourth degree?|Lydian|Dorian|Phrygian|Mixolydian
7|Movies & TV|Which cinematographer shot Blade Runner 2049?|Roger Deakins|Emmanuel Lubezki|Hoyte van Hoytema|Christopher Doyle
7|Sports|Which athlete won the men's Olympic marathon in 1960 running barefoot?|Abebe Bikila|Emil Zátopek|Alain Mimoun|Mamo Wolde
7|Food|Which reaction between amino acids and reducing sugars browns toasted bread?|Maillard reaction|Caramelization|Fermentation|Hydrolysis
7|Technology|Which theorem limits simultaneous consistency and availability during a network partition?|CAP theorem|Bayes' theorem|Noether's theorem|Pythagorean theorem
7|Science|Which physicist proposed the exclusion principle for identical fermions?|Wolfgang Pauli|Max Planck|Niels Bohr|Paul Dirac
7|World|Which country was formerly known as Dahomey?|Benin|Togo|Ghana|Gabon
`;
const standard: Question[] = facts
  .trim()
  .split("\n")
  .map((row, i) => {
    const [tier, category, prompt, answer, ...rest] = row.split("|");
    return {
      id: `q${i + 1}`,
      difficulty: Number(tier),
      category,
      type: "choice",
      prompt,
      answer,
      options: [answer, ...rest],
    };
  });
const extra: Array<
  [number, string, Kind, string, string[], string | string[], string?]
> = [
  [
    1,
    "Animals",
    "binary",
    "Which animal is taller?",
    ["Giraffe", "Rabbit"],
    "Giraffe",
  ],
  [1, "Science", "boolean", "The Sun is a star.", ["True", "False"], "True"],
  [
    1,
    "World",
    "visual",
    "Which is the flag of Italy?",
    ["🇮🇹 Italy", "🇫🇷 France", "🇮🇪 Ireland", "🇲🇽 Mexico"],
    "🇮🇹 Italy",
  ],
  [
    1,
    "Numbers & Comparisons",
    "higher",
    "A week has 7 days. A fortnight has…",
    ["Higher", "Lower"],
    "Higher",
    "A fortnight is 14 days.",
  ],
  [
    1,
    "Numbers & Comparisons",
    "number",
    "How many months are in a year?",
    ["10", "11", "12", "13"],
    "12",
  ],
  [
    1,
    "General Knowledge",
    "order",
    "Put these numbers in ascending order.",
    ["2", "5", "9"],
    ["2", "5", "9"],
  ],
  [
    2,
    "Animals",
    "visual",
    "Which animal is a marsupial?",
    ["🐘 Elephant", "🦘 Kangaroo", "🐅 Tiger", "🐧 Penguin"],
    "🦘 Kangaroo",
  ],
  [
    2,
    "History",
    "number",
    "In which year was the first iPhone released?",
    ["2005", "2006", "2007", "2008"],
    "2007",
  ],
  [
    2,
    "Science",
    "boolean",
    "Sound travels through a vacuum.",
    ["True", "False"],
    "False",
    "Sound needs a medium to travel through.",
  ],
  [
    2,
    "Geography",
    "higher",
    "Mount Everest is about 8,849 m. K2 is…",
    ["Higher", "Lower"],
    "Lower",
    "K2 is 8,611 m high.",
  ],
  [
    2,
    "Science",
    "order",
    "Order these planets from closest to the Sun.",
    ["Mercury", "Earth", "Mars"],
    ["Mercury", "Earth", "Mars"],
  ],
  [
    2,
    "Geography",
    "binary",
    "Which country has a larger total area?",
    ["Canada", "France"],
    "Canada",
  ],
  [
    3,
    "Technology",
    "binary",
    "Which launched first?",
    ["YouTube", "Twitter"],
    "YouTube",
    "YouTube launched in 2005; Twitter in 2006.",
  ],
  [
    3,
    "Technology",
    "order",
    "Order these services by launch, earliest first.",
    ["Facebook", "YouTube", "Instagram"],
    ["Facebook", "YouTube", "Instagram"],
    "2004 → 2005 → 2010.",
  ],
  [
    3,
    "Animals",
    "boolean",
    "Sharks are mammals.",
    ["True", "False"],
    "False",
    "Sharks are cartilaginous fish.",
  ],
  [
    3,
    "History",
    "number",
    "In which year did Apollo 11 land on the Moon?",
    ["1967", "1968", "1969", "1970"],
    "1969",
  ],
  [
    3,
    "Science",
    "higher",
    "Earth has 1 moon. Mars has…",
    ["Higher", "Lower"],
    "Higher",
    "Mars has two moons: Phobos and Deimos.",
  ],
  [
    3,
    "World",
    "visual",
    "Which flag belongs to South Korea?",
    ["🇰🇷 South Korea", "🇯🇵 Japan", "🇨🇳 China", "🇻🇳 Vietnam"],
    "🇰🇷 South Korea",
  ],
  [
    4,
    "Movies & TV",
    "order",
    "Order these films by release, earliest first.",
    ["Jaws", "Star Wars", "E.T."],
    ["Jaws", "Star Wars", "E.T."],
    "1975 → 1977 → 1982.",
  ],
  [
    4,
    "World",
    "binary",
    "Which had a larger population in the 2020 UN estimates?",
    ["Mexico", "Japan"],
    "Mexico",
  ],
  [
    4,
    "Science",
    "boolean",
    "Venus rotates in the opposite direction to Earth.",
    ["True", "False"],
    "True",
  ],
  [
    4,
    "Technology",
    "number",
    "In which year was Wikipedia launched?",
    ["1999", "2000", "2001", "2002"],
    "2001",
  ],
  [
    4,
    "Geography",
    "higher",
    "Mont Blanc is about 4,806 m high. Kilimanjaro is…",
    ["Higher", "Lower"],
    "Higher",
    "Kilimanjaro is 5,895 m high.",
  ],
  [
    4,
    "World",
    "visual",
    "Which flag belongs to Nepal?",
    ["🇳🇵 Nepal", "🇧🇹 Bhutan", "🇱🇰 Sri Lanka", "🇲🇳 Mongolia"],
    "🇳🇵 Nepal",
  ],
  [
    5,
    "History",
    "order",
    "Put these events in order, earliest first.",
    [
      "French Revolution begins",
      "Battle of Waterloo",
      "American Civil War begins",
    ],
    [
      "French Revolution begins",
      "Battle of Waterloo",
      "American Civil War begins",
    ],
    "1789 → 1815 → 1861.",
  ],
  [
    5,
    "Science",
    "binary",
    "Radio waves vs visible light: which travels faster in a vacuum?",
    ["Both travel at the same speed", "Radio waves only"],
    "Both travel at the same speed",
    "Radio waves and visible light are both electromagnetic radiation.",
  ],
  [
    5,
    "Science",
    "boolean",
    "A day on Venus is longer than its year (using sidereal rotation).",
    ["True", "False"],
    "True",
    "One rotation takes about 243 Earth days; one orbit about 225.",
  ],
  [
    5,
    "History",
    "number",
    "In which year did Constantinople fall to the Ottomans?",
    ["1453", "1473", "1493", "1513"],
    "1453",
  ],
  [
    5,
    "Geography",
    "higher",
    "The Danube is about 2,850 km long. The Volga is…",
    ["Higher", "Lower"],
    "Higher",
    "The Volga is about 3,530 km long.",
  ],
  [
    5,
    "World",
    "visual",
    "Which flag belongs to Uruguay?",
    ["🇺🇾 Uruguay", "🇦🇷 Argentina", "🇵🇾 Paraguay", "🇪🇨 Ecuador"],
    "🇺🇾 Uruguay",
  ],
  [
    6,
    "Science",
    "order",
    "Order these elements by atomic number, lowest first.",
    ["Carbon", "Oxygen", "Neon"],
    ["Carbon", "Oxygen", "Neon"],
    "6 → 8 → 10.",
  ],
  [
    6,
    "History",
    "binary",
    "Which university is older?",
    ["Oxford", "Harvard"],
    "Oxford",
    "Teaching at Oxford existed by 1096; Harvard was founded in 1636.",
  ],
  [
    6,
    "Science",
    "boolean",
    "A neutron has a greater rest mass than a proton.",
    ["True", "False"],
    "True",
  ],
  [
    6,
    "History",
    "number",
    "In which year was the Suez Canal opened?",
    ["1859", "1869", "1879", "1889"],
    "1869",
  ],
  [
    6,
    "Science",
    "higher",
    "Mercury has a mean density of about 5.43 g/cm³. Saturn’s is…",
    ["Higher", "Lower"],
    "Lower",
    "Saturn’s mean density is about 0.69 g/cm³.",
  ],
  [
    6,
    "World",
    "visual",
    "Which flag belongs to Bhutan?",
    ["🇧🇹 Bhutan", "🇳🇵 Nepal", "🇲🇲 Myanmar", "🇰🇭 Cambodia"],
    "🇧🇹 Bhutan",
  ],
  [
    7,
    "History",
    "order",
    "Order these inventions by first demonstration or patent, earliest first.",
    [
      "Telephone (Bell patent)",
      "Transistor (Bell Labs)",
      "World Wide Web (proposal)",
    ],
    [
      "Telephone (Bell patent)",
      "Transistor (Bell Labs)",
      "World Wide Web (proposal)",
    ],
    "1876 → 1947 → 1989.",
  ],
  [
    7,
    "Science",
    "binary",
    "Which has the higher first ionization energy?",
    ["Neon", "Sodium"],
    "Neon",
    "Neon has a full outer shell; sodium readily loses its outer electron.",
  ],
  [
    7,
    "Science",
    "boolean",
    "Every continuous function is differentiable.",
    ["True", "False"],
    "False",
    "The absolute-value function is continuous but not differentiable at zero.",
  ],
  [
    7,
    "History",
    "number",
    "In which year was the first successful transatlantic telegraph cable completed (though it soon failed)?",
    ["1848", "1858", "1868", "1878"],
    "1858",
  ],
  [
    7,
    "Science",
    "higher",
    "The speed of sound in air is about 343 m/s at 20°C. In water it is…",
    ["Higher", "Lower"],
    "Higher",
    "In water it is roughly 1,480 m/s, depending on conditions.",
  ],
  [
    7,
    "World",
    "visual",
    "Which flag belongs to Mozambique?",
    ["🇲🇿 Mozambique", "🇿🇲 Zambia", "🇿🇼 Zimbabwe", "🇦🇴 Angola"],
    "🇲🇿 Mozambique",
  ],
];
const original: Question[] = [
  ...standard,
  ...extra.map(
    (
      [difficulty, category, type, prompt, options, answer, explanation],
      i,
    ) => ({
      id: `x${i + 1}`,
      difficulty,
      category,
      type,
      prompt,
      options,
      answer,
      explanation,
    }),
  ),
];
// Flags use native emoji, with accessible country labels hidden visually for flag questions.

// Stable IDs keep historical answers valid. Regraded entries belong to Season 2.
const tierOverrides: Record<string, number> = {
 q31:2,q48:4,q51:4,q67:3,q68:3,q69:3,q70:3,q73:2,q74:2,q75:3,q77:3,q78:2,q80:3,q81:2,q82:3,q84:3,q85:2,q87:2,
 q89:4,q90:4,q91:3,q92:4,q93:4,q94:4,q95:3,q96:3,q97:4,q98:3,q99:4,q100:3,q101:4,q102:3,q103:3,q104:4,q105:4,q106:4,q107:4,q108:3,q109:3,q110:3,
 q111:4,q112:5,q113:5,q114:5,q115:5,q116:3,q117:3,q118:4,q119:6,q120:4,q121:5,q122:3,q123:4,q124:5,q125:4,q126:5,q127:4,q128:4,q129:4,q130:4,q131:5,q132:5,
 q133:4,q134:5,q135:6,q136:6,q137:5,q138:4,q139:6,q140:4,q141:5,q142:5,q143:4,q144:6,q145:5,q146:5,q147:5,q148:6,q149:5,q150:5,q151:5,q152:6,q153:6,q154:5,
 x13:4,x14:4,x15:1,x19:4,x20:4,x21:4,x23:3,x24:4,x25:4,x26:4,x27:5,x28:4,x29:4,x30:4,x31:3,x32:4,x33:5,x34:5,x35:4,x36:5,x37:4,x38:5,x39:5,x40:6,x41:3,x42:5,
};
const catalog: Question[] = [
 ...(additions as Question[]),
 ...original.map(q => ({...q,difficulty:tierOverrides[q.id] ?? q.difficulty,
  prompt:q.id === 'q31' ? 'What does the first W in WWW stand for?' : q.id === 'q108' ? 'Which region is the origin of kimchi?' : q.prompt,
  topicKey:q.id === 'x1' ? 'giraffe-height' : q.id === 'q109' ? 'atmosphere-nitrogen' : q.id,
 })),
 ...(community as Question[]),
 ...(foundations as Question[]).map(q => ({...q,topicKey:q.prompt === 'Which animal is the tallest living land animal?' ? 'giraffe-height' : q.id})),
];

const genreOverrides = {q66:"sports",q76:"history",q88:"politics",q120:"politics",q142:"history",q154:"history"} as const;
export const questions = catalog.map(q=>({...q,genre:genreOverrides[q.id as keyof typeof genreOverrides] ?? categoryGenre(q.category)}));
