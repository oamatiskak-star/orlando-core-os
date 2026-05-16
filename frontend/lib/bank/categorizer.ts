// AI-gebaseerde transactie categorisering op basis van omschrijving
// Patronen gebaseerd op NL bankverkeer

type CategoryRule = {
  category: string
  subcategory?: string
  patterns: RegExp[]
  flags?: { salary?: boolean; savings?: boolean; investment?: boolean; housing?: boolean }
}

const RULES: CategoryRule[] = [
  {
    category: 'wonen',
    subcategory: 'huur',
    patterns: [/huur/i, /verhuur/i, /VVE/i, /servicekosten/i, /erfpacht/i],
    flags: { housing: true },
  },
  {
    category: 'wonen',
    subcategory: 'hypotheek',
    patterns: [/hypotheek/i, /aflossing/i, /Hypotheken/i],
    flags: { housing: true },
  },
  {
    category: 'wonen',
    subcategory: 'energie',
    patterns: [/vattenfall/i, /nuon/i, /eneco/i, /essent/i, /energie/i, /gas.water.licht/i, /electra/i, /nutsbedrijf/i],
  },
  {
    category: 'wonen',
    subcategory: 'verzekering',
    patterns: [/verzekering/i, /interpolis/i, /centraal beheer/i, /nationale nederlanden/i, /achmea/i, /allianz/i],
  },
  {
    category: 'boodschappen',
    patterns: [/albert heijn/i, /AH /i, /jumbo/i, /lidl/i, /aldi/i, /dirk/i, /plus supermarkt/i, /supermarkt/i, /coop/i, /spar/i, /vomar/i, /boni/i],
  },
  {
    category: 'horeca',
    patterns: [/restaurant/i, /cafe /i, /bistro/i, /thuisbezorgd/i, /ubereats/i, /deliveroo/i, /dominos/i, /mcdonalds/i, /kfc/i, /subway/i, /starbucks/i, /coffee/i],
  },
  {
    category: 'auto',
    subcategory: 'brandstof',
    patterns: [/shell/i, /bp /i, /esso/i, /total/i, /texaco/i, /tamoil/i, /tinq/i, /benzinestation/i, /tankstation/i],
  },
  {
    category: 'auto',
    subcategory: 'parking',
    patterns: [/parkeer/i, /q-park/i, /interparking/i, /yellowbrick/i, /parkmobile/i, /autogarage/i],
  },
  {
    category: 'auto',
    subcategory: 'wegenbelasting',
    patterns: [/wegenbelasting/i, /motorrijtuigenbelasting/i, /RDW/i],
  },
  {
    category: 'transport',
    patterns: [/ns /i, /Nederlandse Spoorwegen/i, /OV-chipkaart/i, /GVB/i, /RET/i, /HTM/i, /arriva/i, /connexxion/i, /uber/i, /bolt taxi/i, /taxi/i],
  },
  {
    category: 'abonnementen',
    subcategory: 'streaming',
    patterns: [/netflix/i, /spotify/i, /disney/i, /videoland/i, /hbo/i, /apple\.com\/bill/i, /amazon prime/i, /ziggo/i, /kpn/i, /tmobile/i, /odido/i, /telfort/i, /tele2/i, /youfone/i],
  },
  {
    category: 'gezondheid',
    patterns: [/apotheek/i, /huisarts/i, /tandarts/i, /fysiotherap/i, /ziekenhuis/i, /medisch/i, /eigen risico/i, /CZ/i, /VGZ/i, /Zilveren Kruis/i, /Menzis/i, /DSW/i, /zorgverzekering/i],
  },
  {
    category: 'sport',
    patterns: [/fitness/i, /sportschool/i, /basic-fit/i, /healthclub/i, /zwembad/i, /sportcentrum/i, /tennis/i, /padel/i, /golf/i, /voetbal/i],
  },
  {
    category: 'kleding',
    patterns: [/zara/i, /h&m/i, /primark/i, /wehkamp/i, /bol\.com/i, /zalando/i, /coolcat/i, /only/i, /jack.jones/i, /c&a/i, /river island/i],
  },
  {
    category: 'entertainment',
    patterns: [/bioscoop/i, /cinema/i, /pathe/i, /vue/i, /kinepolis/i, /efteling/i, /pretpark/i, /concertzaal/i, /theater/i, /steam/i, /playstation/i, /xbox/i, /nintendo/i],
  },
  {
    category: 'sparen',
    patterns: [/spaarrekening/i, /spaar/i, /overboeking eigen/i],
    flags: { savings: true },
  },
  {
    category: 'investeren',
    patterns: [/degiro/i, /binck/i, /flatex/i, /trading/i, /aandelen/i, /belegging/i, /etf/i, /bux/i, /revolut.*invest/i, /bitvavo/i, /coinbase/i, /kraken/i, /bitcoin/i, /crypto/i],
    flags: { investment: true },
  },
  {
    category: 'salaris',
    patterns: [/salaris/i, /loon/i, /periodieke overb/i, /strkbeheer/i, /strkbouw/i, /modiwerijo/i, /bouwproffs/i, /amatiskak/i],
    flags: { salary: true },
  },
  {
    category: 'belasting',
    patterns: [/belastingdienst/i, /LHID/i, /BTW/i, /IB /i, /vpb/i, /toeslagen/i],
  },
]

export type CategorizerResult = {
  category: string
  subcategory?: string
  confidence: number
  is_salary: boolean
  is_savings: boolean
  is_investment: boolean
  is_housing: boolean
}

export function categorize(description: string, creditorName?: string, debtorName?: string): CategorizerResult {
  const text = [description, creditorName, debtorName].filter(Boolean).join(' ')

  for (const rule of RULES) {
    const matched = rule.patterns.some(p => p.test(text))
    if (matched) {
      return {
        category:      rule.category,
        subcategory:   rule.subcategory,
        confidence:    0.85,
        is_salary:     rule.flags?.salary     ?? false,
        is_savings:    rule.flags?.savings    ?? false,
        is_investment: rule.flags?.investment ?? false,
        is_housing:    rule.flags?.housing    ?? false,
      }
    }
  }

  return {
    category:      'overig',
    confidence:    0.4,
    is_salary:     false,
    is_savings:    false,
    is_investment: false,
    is_housing:    false,
  }
}
