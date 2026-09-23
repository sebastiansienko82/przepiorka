export interface Icon {
  src: string;
  alt: string;
}

export interface Span {
  month: number;
  day: number | "end";
}

export type Method = "hunt" | "trapping";

export type Condition = "grouse" | "grouse-or-restock" | "ohz-pheasant";

export interface Season {
  who?: string;
  from: Span;
  to: Span;
  method?: Method;
  condition?: Condition;
  icons?: Icon[];
}

export interface Species {
  id: string;
  name: string;
  detail?: string;
  icons: Icon[];
  seasons: Season[];
}

function icon(file: string, alt: string): Icon {
  return { src: `/media/gatunki/${file}.gif`, alt };
}

const jelenByk = icon("image1", "Byk jelenia");
const jelenLania = icon("image2", "Łania");
const jelenCiele = icon("image3", "Cielę jelenia");
const danielByk = icon("image7", "Byk daniela");
const danielLania = icon("image8", "Łania daniela");
const danielCiele = icon("image9", "Cielę daniela");
const kozioł = icon("image34", "Kozioł");
const koza = icon("image10", "Koza");
const kozle = icon("image11", "Koźlę");
const odyniec = icon("image12", "Odyniec");
const wycinek = icon("image13", "Wycinek");
const locha = icon("image14", "Locha");
const warchlak = icon("image15", "Warchlak");
const tryk = icon("image16", "Tryk");
const owca = icon("image17", "Owca muflona");
const jagnie = icon("image18", "Jagnię muflona");
const tchorz = icon("image19", "Tchórz");
const kuna = icon("image20", "Kuna");
const lis = icon("image21", "Lis");
const norka = icon("image23", "Norka amerykańska");
const zajac = icon("image25", "Zając");
const krolik = icon("image26", "Królik");
const kogut = icon("image27", "Kogut bażanta");
const kura = icon("image28", "Kura bażanta");
const kuropatwa = icon("image29", "Kuropatwa");
const kaczka = icon("image31", "Kaczka");
const ges = icon("image32", "Gęś");
const grzywacz = icon("image35", "Gołąb grzywacz");
const borsuk = icon("image36", "Borsuk");
const szakal = icon("image50", "Szakal złocisty");

export const CONDITIONS: Record<Condition, string> = {
  grouse: "Tylko w obwodach, w których występuje głuszec lub cietrzew",
  "grouse-or-restock":
    "Tylko w obwodach z głuszcem lub cietrzewiem albo po zasiedleniu zająca, bażanta lub kuropatwy w ostatnich 2 latach",
  "ohz-pheasant": "Tylko w ośrodku hodowli zwierzyny z wolierową hodowlą bażanta",
};

export const MONTHS = [
  { id: "styczen", name: "Styczeń", number: 1 },
  { id: "luty", name: "Luty", number: 2 },
  { id: "marzec", name: "Marzec", number: 3 },
  { id: "kwiecien", name: "Kwiecień", number: 4 },
  { id: "maj", name: "Maj", number: 5 },
  { id: "czerwiec", name: "Czerwiec", number: 6 },
  { id: "lipiec", name: "Lipiec", number: 7 },
  { id: "sierpien", name: "Sierpień", number: 8 },
  { id: "wrzesien", name: "Wrzesień", number: 9 },
  { id: "pazdziernik", name: "Październik", number: 10 },
  { id: "listopad", name: "Listopad", number: 11 },
  { id: "grudzien", name: "Grudzień", number: 12 },
] as const;

/** Okresy ogólnopolskie. Wyjątki innych województw są pominięte. */
export const SPECIES: Species[] = [
  {
    id: "jelen",
    name: "Jelenie szlachetne",
    icons: [jelenByk, jelenLania, jelenCiele],
    seasons: [
      { who: "byki", from: { month: 8, day: 21 }, to: { month: 2, day: "end" }, icons: [jelenByk] },
      { who: "łanie", from: { month: 9, day: 1 }, to: { month: 1, day: 15 }, icons: [jelenLania] },
      { who: "cielęta", from: { month: 9, day: 1 }, to: { month: 2, day: "end" }, icons: [jelenCiele] },
    ],
  },
  {
    id: "daniel",
    name: "Daniele",
    icons: [danielByk, danielLania, danielCiele],
    seasons: [
      { who: "byki", from: { month: 9, day: 1 }, to: { month: 2, day: "end" }, icons: [danielByk] },
      { who: "łanie", from: { month: 9, day: 1 }, to: { month: 1, day: 15 }, icons: [danielLania] },
      { who: "cielęta", from: { month: 9, day: 1 }, to: { month: 2, day: "end" }, icons: [danielCiele] },
    ],
  },
  {
    id: "sarna",
    name: "Sarny",
    icons: [kozioł, koza, kozle],
    seasons: [
      { who: "kozły", from: { month: 5, day: 11 }, to: { month: 9, day: 30 }, icons: [kozioł] },
      { who: "kozy i koźlęta", from: { month: 10, day: 1 }, to: { month: 1, day: 15 }, icons: [koza, kozle] },
    ],
  },
  {
    id: "dzik",
    name: "Dziki",
    icons: [odyniec, wycinek, locha, warchlak],
    seasons: [{ from: { month: 1, day: 1 }, to: { month: 12, day: 31 } }],
  },
  {
    id: "muflon",
    name: "Muflony",
    icons: [tryk, owca, jagnie],
    seasons: [
      { who: "tryki", from: { month: 10, day: 1 }, to: { month: 2, day: "end" }, icons: [tryk] },
      { who: "owce i jagnięta", from: { month: 10, day: 1 }, to: { month: 1, day: 15 }, icons: [owca, jagnie] },
    ],
  },
  {
    id: "borsuk",
    name: "Borsuki",
    icons: [borsuk],
    seasons: [
      { from: { month: 9, day: 1 }, to: { month: 11, day: 30 } },
      { from: { month: 12, day: 1 }, to: { month: 8, day: 31 }, condition: "grouse" },
    ],
  },
  {
    id: "tchorz-kuna",
    name: "Tchórze i kuny",
    icons: [tchorz, kuna],
    seasons: [
      { from: { month: 9, day: 1 }, to: { month: 3, day: 31 } },
      { from: { month: 4, day: 1 }, to: { month: 8, day: 31 }, condition: "grouse" },
    ],
  },
  {
    id: "lis",
    name: "Lisy",
    icons: [lis],
    seasons: [
      { from: { month: 6, day: 1 }, to: { month: 3, day: 31 } },
      { from: { month: 4, day: 1 }, to: { month: 5, day: 31 }, condition: "grouse-or-restock" },
    ],
  },
  {
    id: "norka",
    name: "Norki amerykańskie",
    icons: [norka],
    seasons: [{ from: { month: 1, day: 1 }, to: { month: 12, day: 31 } }],
  },
  {
    id: "szakal",
    name: "Szakale złociste",
    icons: [szakal],
    seasons: [
      { from: { month: 8, day: 1 }, to: { month: 2, day: "end" } },
      { from: { month: 3, day: 1 }, to: { month: 7, day: 31 }, condition: "grouse-or-restock" },
    ],
  },
  {
    id: "zajac",
    name: "Zające szaraki i dzikie króliki",
    icons: [zajac, krolik],
    seasons: [
      { from: { month: 11, day: 1 }, to: { month: 12, day: 31 } },
      { from: { month: 11, day: 1 }, to: { month: 1, day: 15 }, method: "trapping" },
    ],
  },
  {
    id: "bazant",
    name: "Bażanty",
    icons: [kogut, kura],
    seasons: [
      { who: "koguty", from: { month: 10, day: 1 }, to: { month: 2, day: "end" }, icons: [kogut] },
      { who: "kury", from: { month: 10, day: 1 }, to: { month: 1, day: 31 }, condition: "ohz-pheasant", icons: [kura] },
    ],
  },
  {
    id: "kuropatwa",
    name: "Kuropatwy",
    icons: [kuropatwa],
    seasons: [
      { from: { month: 9, day: 11 }, to: { month: 10, day: 21 } },
      { from: { month: 9, day: 11 }, to: { month: 1, day: 15 }, method: "trapping" },
    ],
  },
  {
    id: "kaczka",
    name: "Kaczki",
    detail: "krzyżówka i cyraneczka",
    icons: [kaczka],
    seasons: [{ from: { month: 9, day: 1 }, to: { month: 12, day: 31 } }],
  },
  {
    id: "ges",
    name: "Gęsi",
    detail: "gęgawa, zbożowa i białoczelna",
    icons: [ges],
    seasons: [{ from: { month: 9, day: 1 }, to: { month: 12, day: 21 } }],
  },
  {
    id: "grzywacz",
    name: "Gołębie grzywacze",
    icons: [grzywacz],
    seasons: [{ from: { month: 8, day: 15 }, to: { month: 11, day: 30 } }],
  },
];
