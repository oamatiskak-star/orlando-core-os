'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calculator, ChevronDown, ChevronRight, ChevronLeft, Plus, Trash2,
  Printer, ArrowLeft, Pencil, Check, Copy, ChevronUp, Download,
  X, Search, Hammer, Home, Zap, Droplet, Flame, Wind, Sun, Wrench,
  Layers, AlertTriangle, Paintbrush, Box, Thermometer, Sigma,
} from 'lucide-react'
import clsx from 'clsx'

// ─── Types ───────────────────────────────────────────────────────────────────

type Soort = 'materiaal' | 'arbeid' | 'materieel' | 'onderaanneming'

interface Onderdeel {
  id: string
  soort: Soort
  omschrijving: string
  norm: string      // hoeveelheid per eenheid van het element
  eenheid: string   // eenheid van het onderdeel (kg, st, uur, ...)
  prijs: string     // tarief per onderdeel-eenheid
}

interface Post {
  id: string
  omschrijving: string
  hoeveelheid: string   // hoeveelheid van het element (bijv. 50 m²)
  eenheid: string       // eenheid van het element (m², m³, st)
  eenheidsprijs: string // directe prijs/eenheid — gebruikt als opbouw leeg is
  opbouw: Onderdeel[]   // receptuur (samengesteld element)
  open: boolean         // opbouw uitgeklapt?
}

interface Hoofdstuk {
  id: string
  naam: string
  posten: Post[]
  open: boolean
}

// MAMO-soorten met label + kleur
const SOORTEN: { key: Soort; label: string; kort: string; cls: string }[] = [
  { key: 'materiaal',      label: 'Materiaal',      kort: 'MAT', cls: 'text-sky-300 bg-sky-500/15 border-sky-500/25' },
  { key: 'arbeid',         label: 'Arbeid',         kort: 'ARB', cls: 'text-amber-300 bg-amber-500/15 border-amber-500/25' },
  { key: 'materieel',      label: 'Materieel',      kort: 'MTL', cls: 'text-violet-300 bg-violet-500/15 border-violet-500/25' },
  { key: 'onderaanneming', label: 'Onderaanneming', kort: 'OA',  cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/25' },
]
const soortInfo = (s: Soort) => SOORTEN.find(x => x.key === s) ?? SOORTEN[0]

// ─── Combi-seed types ─────────────────────────────────────────────────────────

interface OnderdeelSeed { soort: Soort; omschrijving: string; norm: string; eenheid: string; prijs: string }
interface CombiRegel {
  omschrijving: string
  hoeveelheid: string
  eenheid: string
  eenheidsprijs: string
  opbouw?: OnderdeelSeed[]
}

// ─── Pre-built combis ─────────────────────────────────────────────────────────

const COMBIS: Record<string, CombiRegel[]> = {

  Sloopwerk: [
    { omschrijving: 'Sloop bestaande vloer (incl. afvoer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '12.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'Sloper', norm: '0.25', eenheid: 'uur', prijs: '38.00' },
      { soort: 'materieel', omschrijving: 'Klein sloopgereedschap', norm: '1', eenheid: 'm²', prijs: '2.50' },
    ] },
    { omschrijving: 'Sloop binnenwanden (incl. afvoer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '18.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'Sloper', norm: '0.35', eenheid: 'uur', prijs: '38.00' },
      { soort: 'materieel', omschrijving: 'Sloophamer / gereedschap', norm: '1', eenheid: 'm²', prijs: '2.00' },
      { soort: 'onderaanneming', omschrijving: 'Afvoer en verwerking puin', norm: '1', eenheid: 'm²', prijs: '2.70' },
    ] },
    { omschrijving: 'Sloop dakbeschot / pannen', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '22.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'Sloper', norm: '0.40', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Steiger / dakwerkbeveiliging', norm: '1', eenheid: 'm²', prijs: '3.00' },
      { soort: 'onderaanneming', omschrijving: 'Afvoer pannen en hout', norm: '1', eenheid: 'm²', prijs: '3.00' },
    ] },
    { omschrijving: 'Sloop badkamerinstallatie compleet', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '850.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'Sloper', norm: '16', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap en bescherming', norm: '1', eenheid: 'ls', prijs: '80.00' },
      { soort: 'onderaanneming', omschrijving: 'Afvoer en stortkosten', norm: '1', eenheid: 'ls', prijs: '130.00' },
    ] },
    { omschrijving: 'Sloop keuken (incl. apparatuur)', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '680.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'Sloper', norm: '12', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'ls', prijs: '60.00' },
      { soort: 'onderaanneming', omschrijving: 'Afvoer en stortkosten', norm: '1', eenheid: 'ls', prijs: '140.00' },
    ] },
    { omschrijving: 'Breekwerk beton / fundering', hoeveelheid: '', eenheid: 'm³', eenheidsprijs: '180.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'Sloper', norm: '2.5', eenheid: 'uur', prijs: '42.00' },
      { soort: 'materieel', omschrijving: 'Sloophamer / minigraver', norm: '1', eenheid: 'm³', prijs: '45.00' },
      { soort: 'onderaanneming', omschrijving: 'Afvoer betonpuin', norm: '1', eenheid: 'm³', prijs: '30.00' },
    ] },
    { omschrijving: 'Afvoer puin (container 6 m³)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '390.00', opbouw: [
      { soort: 'onderaanneming', omschrijving: 'Containerhuur en stortkosten', norm: '1', eenheid: 'st', prijs: '330.00' },
      { soort: 'arbeid', omschrijving: 'Laden container', norm: '1.5', eenheid: 'uur', prijs: '40.00' },
    ] },
  ],

  'Fundering & Grondwerk': [
    { omschrijving: 'Grondwerk / ontgraving', hoeveelheid: '', eenheid: 'm³', eenheidsprijs: '28.00', opbouw: [
      { soort: 'materieel', omschrijving: 'Graafmachine incl. machinist', norm: '1', eenheid: 'm³', prijs: '12.00' },
      { soort: 'arbeid', omschrijving: 'Grondwerker', norm: '0.25', eenheid: 'uur', prijs: '38.00' },
      { soort: 'onderaanneming', omschrijving: 'Tussenopslag / verzet', norm: '1', eenheid: 'm³', prijs: '6.50' },
    ] },
    { omschrijving: 'Grond afvoeren (per vracht)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '320.00', opbouw: [
      { soort: 'onderaanneming', omschrijving: 'Transport en verwerking grond', norm: '1', eenheid: 'st', prijs: '280.00' },
      { soort: 'arbeid', omschrijving: 'Beladen', norm: '1', eenheid: 'uur', prijs: '40.00' },
    ] },
    { omschrijving: 'Betonnen strookfundering', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '185.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Beton C20/25', norm: '0.15', eenheid: 'm³', prijs: '130.00' },
      { soort: 'materiaal', omschrijving: 'Wapeningsstaal', norm: '8', eenheid: 'kg', prijs: '1.40' },
      { soort: 'materiaal', omschrijving: 'Bekisting', norm: '2', eenheid: 'm²', prijs: '8.00' },
      { soort: 'arbeid', omschrijving: 'Betontimmerman', norm: '2.5', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Klein materieel', norm: '1', eenheid: 'm¹', prijs: '23.00' },
    ] },
    { omschrijving: 'Vloerplaat beton 15 cm (incl. wapening)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Beton C20/25', norm: '0.16', eenheid: 'm³', prijs: '130.00' },
      { soort: 'materiaal', omschrijving: 'Wapeningsnet', norm: '1', eenheid: 'm²', prijs: '8.00' },
      { soort: 'materiaal', omschrijving: 'PE-folie', norm: '1', eenheid: 'm²', prijs: '2.00' },
      { soort: 'arbeid', omschrijving: 'Betonwerker', norm: '1.1', eenheid: 'uur', prijs: '46.00' },
    ] },
    { omschrijving: 'Poer beton (per stuk)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '380.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Beton C20/25', norm: '0.4', eenheid: 'm³', prijs: '130.00' },
      { soort: 'materiaal', omschrijving: 'Wapening', norm: '20', eenheid: 'kg', prijs: '1.40' },
      { soort: 'materiaal', omschrijving: 'Bekisting', norm: '1', eenheid: 'st', prijs: '40.00' },
      { soort: 'arbeid', omschrijving: 'Betontimmerman', norm: '4.5', eenheid: 'uur', prijs: '46.00' },
    ] },
    { omschrijving: 'Onderstopsel bestaande fundering', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '280.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Krimpvrije mortel', norm: '1', eenheid: 'm¹', prijs: '60.00' },
      { soort: 'arbeid', omschrijving: 'Funderingsspecialist', norm: '4', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Stempels / gereedschap', norm: '1', eenheid: 'm¹', prijs: '36.00' },
    ] },
    { omschrijving: 'Kruipruimte drainage', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '45.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Drainagebuis + grind', norm: '1', eenheid: 'm¹', prijs: '18.00' },
      { soort: 'arbeid', omschrijving: 'Grondwerker', norm: '0.5', eenheid: 'uur', prijs: '38.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '8.00' },
    ] },
    { omschrijving: 'Zandbed / aanvulzand', hoeveelheid: '', eenheid: 'm³', eenheidsprijs: '38.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Ophoogzand', norm: '1', eenheid: 'm³', prijs: '22.00' },
      { soort: 'arbeid', omschrijving: 'Grondwerker', norm: '0.3', eenheid: 'uur', prijs: '38.00' },
      { soort: 'materieel', omschrijving: 'Trilplaat', norm: '1', eenheid: 'm³', prijs: '4.60' },
    ] },
  ],

  // Metselwerk — showcase combi mét volledige receptuur (samengestelde elementen)
  Metselwerk: [
    {
      omschrijving: 'Binnenwand metselwerk 10 cm', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00',
      opbouw: [
        { soort: 'materiaal', omschrijving: 'Kalkzandsteen lijmblok 100 mm', norm: '1',    eenheid: 'm²',  prijs: '24.00' },
        { soort: 'materiaal', omschrijving: 'Lijmmortel kalkzandsteen',       norm: '0.012', eenheid: 'm³', prijs: '210.00' },
        { soort: 'arbeid',    omschrijving: 'Metselaar',                      norm: '0.85', eenheid: 'uur', prijs: '48.00' },
        { soort: 'arbeid',    omschrijving: 'Opperman',                       norm: '0.35', eenheid: 'uur', prijs: '38.00' },
        { soort: 'materieel', omschrijving: 'Klein gereedschap / mengkuip',   norm: '1',    eenheid: 'm²',  prijs: '2.50' },
      ],
    },
    {
      omschrijving: 'Buitengevel metselwerk 21 cm (spouw)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '165.00',
      opbouw: [
        { soort: 'materiaal', omschrijving: 'Gevelsteen waalformaat',          norm: '100',  eenheid: 'st',  prijs: '0.55' },
        { soort: 'materiaal', omschrijving: 'Metselmortel',                     norm: '0.04', eenheid: 'm³',  prijs: '180.00' },
        { soort: 'materiaal', omschrijving: 'Spouwanker RVS',                   norm: '5',    eenheid: 'st',  prijs: '0.85' },
        { soort: 'materiaal', omschrijving: 'Spouwisolatie minerale wol 100 mm', norm: '1',  eenheid: 'm²',  prijs: '14.00' },
        { soort: 'arbeid',    omschrijving: 'Metselaar',                        norm: '1.15', eenheid: 'uur', prijs: '48.00' },
        { soort: 'arbeid',    omschrijving: 'Opperman',                         norm: '0.50', eenheid: 'uur', prijs: '38.00' },
        { soort: 'materieel', omschrijving: 'Steiger (toeslag per m²)',         norm: '1',    eenheid: 'm²',  prijs: '6.00' },
      ],
    },
    {
      omschrijving: 'Borstwering / latei metselwerk', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '120.00',
      opbouw: [
        { soort: 'materiaal', omschrijving: 'Gevelsteen waalformaat', norm: '60',   eenheid: 'st',  prijs: '0.55' },
        { soort: 'materiaal', omschrijving: 'Metselmortel',           norm: '0.025', eenheid: 'm³', prijs: '180.00' },
        { soort: 'arbeid',    omschrijving: 'Metselaar',              norm: '1.4',  eenheid: 'uur', prijs: '48.00' },
        { soort: 'arbeid',    omschrijving: 'Opperman',               norm: '0.6',  eenheid: 'uur', prijs: '38.00' },
      ],
    },
    { omschrijving: 'Schoorsteenkanaal metselwerk', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '320.00' },
    { omschrijving: 'Koppelstenen / ankers spouwmuur', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '4.50' },
    {
      omschrijving: 'Gevelvoegen bijwerken', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '38.00',
      opbouw: [
        { soort: 'materiaal', omschrijving: 'Voegmortel',     norm: '0.008', eenheid: 'm³', prijs: '220.00' },
        { soort: 'arbeid',    omschrijving: 'Voeger',         norm: '0.55',  eenheid: 'uur', prijs: '46.00' },
        { soort: 'materieel', omschrijving: 'Steiger toeslag', norm: '1',    eenheid: 'm²',  prijs: '6.00' },
      ],
    },
    { omschrijving: 'Betonnen lateibalk plaatsen', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '280.00' },
  ],

  Betonwerk: [
    { omschrijving: 'Gestort beton constructievloer (15 cm)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Beton C20/25', norm: '0.16', eenheid: 'm³', prijs: '130.00' },
      { soort: 'materiaal', omschrijving: 'Wapeningsnet', norm: '1', eenheid: 'm²', prijs: '8.00' },
      { soort: 'materiaal', omschrijving: 'Onderstempeling / bekisting', norm: '1', eenheid: 'm²', prijs: '12.00' },
      { soort: 'arbeid', omschrijving: 'Betonwerker', norm: '0.9', eenheid: 'uur', prijs: '46.00' },
    ] },
    { omschrijving: 'Betonnen wand bekisten en storten', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '185.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Beton C20/25', norm: '0.2', eenheid: 'm³', prijs: '130.00' },
      { soort: 'materiaal', omschrijving: 'Wapening', norm: '12', eenheid: 'kg', prijs: '1.40' },
      { soort: 'materiaal', omschrijving: 'Bekisting (2-zijdig)', norm: '2', eenheid: 'm²', prijs: '25.00' },
      { soort: 'arbeid', omschrijving: 'Betontimmerman', norm: '1.6', eenheid: 'uur', prijs: '46.00' },
    ] },
    { omschrijving: 'Prefab betonnen element plaatsen', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '650.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Prefab element', norm: '1', eenheid: 'st', prijs: '420.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '3', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Mobiele kraan (aandeel)', norm: '1', eenheid: 'st', prijs: '92.00' },
    ] },
    { omschrijving: 'Betonnen trap gieten', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '2800.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Beton C20/25', norm: '0.8', eenheid: 'm³', prijs: '130.00' },
      { soort: 'materiaal', omschrijving: 'Wapening', norm: '60', eenheid: 'kg', prijs: '1.40' },
      { soort: 'materiaal', omschrijving: 'Bekisting maatwerk', norm: '1', eenheid: 'ls', prijs: '450.00' },
      { soort: 'arbeid', omschrijving: 'Betontimmerman', norm: '30', eenheid: 'uur', prijs: '46.00' },
    ] },
    { omschrijving: 'Betonherstel (reparatiemortel)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '65.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Reparatiemortel', norm: '1', eenheid: 'm²', prijs: '18.00' },
      { soort: 'arbeid', omschrijving: 'Betonhersteller', norm: '0.9', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '5.60' },
    ] },
    { omschrijving: 'Wapeningsstaal (incl. verbinden)', hoeveelheid: '', eenheid: 'kg', eenheidsprijs: '2.20', opbouw: [
      { soort: 'materiaal', omschrijving: 'Betonstaal', norm: '1', eenheid: 'kg', prijs: '1.10' },
      { soort: 'arbeid', omschrijving: 'IJzervlechter', norm: '0.02', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Binddraad / gereedschap', norm: '1', eenheid: 'kg', prijs: '0.18' },
    ] },
  ],

  Riolering: [
    { omschrijving: 'PVC-rioolbuis ø110 binnenriolering', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '48.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'PVC-buis ø110 + fittingen', norm: '1', eenheid: 'm¹', prijs: '16.00' },
      { soort: 'arbeid', omschrijving: 'Rioleur', norm: '0.55', eenheid: 'uur', prijs: '42.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '8.90' },
    ] },
    { omschrijving: 'PVC-rioolbuis ø160 buitenriolering', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '68.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'PVC-buis ø160 + fittingen', norm: '1', eenheid: 'm¹', prijs: '24.00' },
      { soort: 'arbeid', omschrijving: 'Rioleur', norm: '0.7', eenheid: 'uur', prijs: '42.00' },
      { soort: 'materieel', omschrijving: 'Graaf- en gereedschap', norm: '1', eenheid: 'm¹', prijs: '14.60' },
    ] },
    { omschrijving: 'PVC-rioolbuis ø200 hoofdriool', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '95.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'PVC-buis ø200 + fittingen', norm: '1', eenheid: 'm¹', prijs: '38.00' },
      { soort: 'arbeid', omschrijving: 'Rioleur', norm: '0.85', eenheid: 'uur', prijs: '42.00' },
      { soort: 'materieel', omschrijving: 'Graafmachine (aandeel)', norm: '1', eenheid: 'm¹', prijs: '21.30' },
    ] },
    { omschrijving: 'Kolkput plaatsen (incl. rooster)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '420.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Kolkput + gietijzeren rooster', norm: '1', eenheid: 'st', prijs: '260.00' },
      { soort: 'arbeid', omschrijving: 'Rioleur', norm: '2.5', eenheid: 'uur', prijs: '42.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '55.00' },
    ] },
    { omschrijving: 'Putje / cleanout aansluiting', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '185.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Ontstoppingsstuk + deksel', norm: '1', eenheid: 'st', prijs: '95.00' },
      { soort: 'arbeid', omschrijving: 'Rioleur', norm: '1.8', eenheid: 'uur', prijs: '42.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '14.40' },
    ] },
    { omschrijving: 'Pompput met vlotter', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1850.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Pomp + put + vlotter', norm: '1', eenheid: 'st', prijs: '1250.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '8', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Graaf- en hijswerk', norm: '1', eenheid: 'st', prijs: '232.00' },
    ] },
    { omschrijving: 'Infiltratiekrat plaatsen (incl. grond)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '320.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Infiltratiekrat + omhulling', norm: '1', eenheid: 'st', prijs: '180.00' },
      { soort: 'arbeid', omschrijving: 'Grondwerker', norm: '2.5', eenheid: 'uur', prijs: '42.00' },
      { soort: 'materieel', omschrijving: 'Graafwerk', norm: '1', eenheid: 'st', prijs: '35.00' },
    ] },
    { omschrijving: 'Ontstoppen riolering', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '285.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'Rioolspecialist', norm: '2', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Hogedrukunit', norm: '1', eenheid: 'ls', prijs: '120.00' },
      { soort: 'onderaanneming', omschrijving: 'Camera-inspectie', norm: '1', eenheid: 'ls', prijs: '61.00' },
    ] },
  ],

  Asbestsanering: [
    { omschrijving: 'Asbestinventarisatie (RI&E-rapport)', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '650.00', opbouw: [
      { soort: 'onderaanneming', omschrijving: 'Gecertificeerd inventarisatiebureau', norm: '1', eenheid: 'ls', prijs: '650.00' },
    ] },
    { omschrijving: 'Sanering asbestcement-platen (risicoklasse 1)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '45.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'DTA-saneerder', norm: '0.5', eenheid: 'uur', prijs: '55.00' },
      { soort: 'materiaal', omschrijving: 'Verpakking / folie', norm: '1', eenheid: 'm²', prijs: '6.00' },
      { soort: 'onderaanneming', omschrijving: 'Stort gevaarlijk afval', norm: '1', eenheid: 'm²', prijs: '11.50' },
    ] },
    { omschrijving: 'Sanering asbestcement-platen (risicoklasse 2)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'DTA-saneerder', norm: '0.9', eenheid: 'uur', prijs: '55.00' },
      { soort: 'materieel', omschrijving: 'Containment / decontaminatie', norm: '1', eenheid: 'm²', prijs: '25.00' },
      { soort: 'onderaanneming', omschrijving: 'Stort gevaarlijk afval', norm: '1', eenheid: 'm²', prijs: '20.50' },
    ] },
    { omschrijving: 'Sanering asbestvezels / hechtgebonden', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '120.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'DTA-saneerder', norm: '1.2', eenheid: 'uur', prijs: '55.00' },
      { soort: 'materieel', omschrijving: 'Containment / onderdruk', norm: '1', eenheid: 'm²', prijs: '30.00' },
      { soort: 'onderaanneming', omschrijving: 'Stort gevaarlijk afval', norm: '1', eenheid: 'm²', prijs: '24.00' },
    ] },
    { omschrijving: 'Sanering asbestleidingen / bochtstukken', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '85.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'DTA-saneerder', norm: '0.9', eenheid: 'uur', prijs: '55.00' },
      { soort: 'materieel', omschrijving: 'Inpakmateriaal / gereedschap', norm: '1', eenheid: 'm¹', prijs: '20.00' },
      { soort: 'onderaanneming', omschrijving: 'Stortkosten', norm: '1', eenheid: 'm¹', prijs: '15.50' },
    ] },
    { omschrijving: 'Afvoer en verwerking asbest (gecertificeerd)', hoeveelheid: '', eenheid: 'ton', eenheidsprijs: '980.00', opbouw: [
      { soort: 'onderaanneming', omschrijving: 'Gecertificeerde stort', norm: '1', eenheid: 'ton', prijs: '820.00' },
      { soort: 'arbeid', omschrijving: 'Laden en transport begeleiden', norm: '2', eenheid: 'uur', prijs: '55.00' },
      { soort: 'materieel', omschrijving: 'Transportmiddel (aandeel)', norm: '1', eenheid: 'ton', prijs: '50.00' },
    ] },
  ],

  Dakwerk: [
    { omschrijving: 'Dakpannen vervangen (incl. tengels, lat)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Dakpannen + panlatten + tengels', norm: '1', eenheid: 'm²', prijs: '34.00' },
      { soort: 'arbeid', omschrijving: 'Dakdekker', norm: '0.8', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Steiger / ladderlift', norm: '1', eenheid: 'm²', prijs: '24.20' },
    ] },
    { omschrijving: 'Bitumen dakbedekking plat dak (2-laags)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '85.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Bitumen 2-laags + isolatielaag', norm: '1', eenheid: 'm²', prijs: '34.00' },
      { soort: 'arbeid', omschrijving: 'Dakdekker', norm: '0.7', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Brander / steiger', norm: '1', eenheid: 'm²', prijs: '18.80' },
    ] },
    { omschrijving: 'EPDM dakbedekking plat dak', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '78.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'EPDM-folie + lijm', norm: '1', eenheid: 'm²', prijs: '36.00' },
      { soort: 'arbeid', omschrijving: 'Dakdekker', norm: '0.65', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap / steiger', norm: '1', eenheid: 'm²', prijs: '12.10' },
    ] },
    { omschrijving: 'Dakgoot vervangen (zink)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '68.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Zinken goot + beugels', norm: '1', eenheid: 'm¹', prijs: '34.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter/dakdekker', norm: '0.6', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Ladder / steiger', norm: '1', eenheid: 'm¹', prijs: '6.40' },
    ] },
    { omschrijving: 'Hemelwaterafvoer PVC ø80 (incl. klemmen)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '38.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'PVC-buis ø80 + klemmen', norm: '1', eenheid: 'm¹', prijs: '16.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '0.4', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Ladder', norm: '1', eenheid: 'm¹', prijs: '3.60' },
    ] },
    { omschrijving: 'Nokvorst vernieuwen (incl. mortel)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '95.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Vorsten + mortel/clips', norm: '1', eenheid: 'm¹', prijs: '38.00' },
      { soort: 'arbeid', omschrijving: 'Dakdekker', norm: '0.9', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Steiger', norm: '1', eenheid: 'm¹', prijs: '15.60' },
    ] },
    { omschrijving: 'Dakrenovatie incl. ondervloer', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '145.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Onderdak + pannen + latten', norm: '1', eenheid: 'm²', prijs: '62.00' },
      { soort: 'arbeid', omschrijving: 'Dakdekker', norm: '1.2', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Steiger / afvoer', norm: '1', eenheid: 'm²', prijs: '27.80' },
    ] },
    { omschrijving: 'Dakbeschot hout (OSB/vuren)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '42.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'OSB / vuren beschot', norm: '1', eenheid: 'm²', prijs: '18.00' },
      { soort: 'arbeid', omschrijving: 'Timmerman', norm: '0.4', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '5.60' },
    ] },
    { omschrijving: 'Loodwerk afdichting (borstweringen, schoorstenen)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '95.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Lood + kit', norm: '1', eenheid: 'm¹', prijs: '42.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '0.9', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Steiger', norm: '1', eenheid: 'm¹', prijs: '11.60' },
    ] },
  ],

  'Dakkapel & Dakraam': [
    { omschrijving: 'Dakkapel plaatsen (hout, standaard 3 m breed)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '14500.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Prefab dakkapel + afwerking', norm: '1', eenheid: 'st', prijs: '8500.00' },
      { soort: 'arbeid', omschrijving: 'Timmerman/monteur', norm: '60', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Kraan / steiger', norm: '1', eenheid: 'st', prijs: '1620.00' },
      { soort: 'onderaanneming', omschrijving: 'Afwerking binnen + lood', norm: '1', eenheid: 'st', prijs: '1500.00' },
    ] },
    { omschrijving: 'Dakraam Velux 78×98 incl. montage + kraag', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1450.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Velux 78×98 + gootstuk', norm: '1', eenheid: 'st', prijs: '780.00' },
      { soort: 'arbeid', omschrijving: 'Dakdekker', norm: '8', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Steiger / gereedschap', norm: '1', eenheid: 'st', prijs: '286.00' },
    ] },
    { omschrijving: 'Dakraam Velux 78×118 incl. montage + kraag', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1750.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Velux 78×118 + gootstuk', norm: '1', eenheid: 'st', prijs: '980.00' },
      { soort: 'arbeid', omschrijving: 'Dakdekker', norm: '9', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Steiger / gereedschap', norm: '1', eenheid: 'st', prijs: '338.00' },
    ] },
    { omschrijving: 'Dakraam Velux 114×118 incl. montage + kraag', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '2200.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Velux 114×118 + gootstuk', norm: '1', eenheid: 'st', prijs: '1300.00' },
      { soort: 'arbeid', omschrijving: 'Dakdekker', norm: '11', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Steiger / gereedschap', norm: '1', eenheid: 'st', prijs: '372.00' },
    ] },
    { omschrijving: 'Lood rondom dakraam / dakkapel', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '380.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Lood + kit', norm: '1', eenheid: 'ls', prijs: '160.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '4', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'ls', prijs: '28.00' },
    ] },
    { omschrijving: 'Dakkapel schilderwerk (buiten)', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '1200.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Verf / grondlaag', norm: '1', eenheid: 'ls', prijs: '180.00' },
      { soort: 'arbeid', omschrijving: 'Schilder', norm: '18', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Steiger', norm: '1', eenheid: 'ls', prijs: '192.00' },
    ] },
    { omschrijving: 'Uitbouw kap (dakhelling wijzigen)', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '8500.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Hout + pannen + isolatie', norm: '1', eenheid: 'ls', prijs: '3200.00' },
      { soort: 'arbeid', omschrijving: 'Timmerman/dakdekker', norm: '80', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Steiger / afvoer', norm: '1', eenheid: 'ls', prijs: '1460.00' },
    ] },
  ],

  Isolatie: [
    { omschrijving: 'Spouwmuurisolatie (ingeblazen EPS)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '28.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'EPS-parels / minerale wol', norm: '1', eenheid: 'm²', prijs: '16.00' },
      { soort: 'arbeid', omschrijving: 'Isolatiemonteur', norm: '0.2', eenheid: 'uur', prijs: '42.00' },
      { soort: 'materieel', omschrijving: 'Inblaasmachine', norm: '1', eenheid: 'm²', prijs: '3.60' },
    ] },
    { omschrijving: 'Dakisolatie PIR 10 cm', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '38.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'PIR-plaat 100 mm', norm: '1', eenheid: 'm²', prijs: '24.00' },
      { soort: 'arbeid', omschrijving: 'Dakdekker', norm: '0.25', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '2.50' },
    ] },
    { omschrijving: 'Dakisolatie PIR 14 cm', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '48.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'PIR-plaat 140 mm', norm: '1', eenheid: 'm²', prijs: '32.00' },
      { soort: 'arbeid', omschrijving: 'Dakdekker', norm: '0.28', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '3.12' },
    ] },
    { omschrijving: 'Vloerisolatie EPS (onder dekvloer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '35.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'EPS-platen', norm: '1', eenheid: 'm²', prijs: '22.00' },
      { soort: 'arbeid', omschrijving: 'Isolatiemonteur', norm: '0.25', eenheid: 'uur', prijs: '42.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '2.50' },
    ] },
    { omschrijving: 'Binnenisolatie wand (gipskarton + rockwool)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '65.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Gipskarton + rockwool + regels', norm: '1', eenheid: 'm²', prijs: '34.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '0.6', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '3.40' },
    ] },
    { omschrijving: 'Gevelisolatie buitenzijde (composiet systeem)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '120.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Isolatieplaat + wapening + pleister', norm: '1', eenheid: 'm²', prijs: '58.00' },
      { soort: 'arbeid', omschrijving: 'Gevelisolatiemonteur', norm: '1.2', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Steiger', norm: '1', eenheid: 'm²', prijs: '6.80' },
    ] },
    { omschrijving: 'HR++ glas (vervangen beglazing)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '185.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'HR++ glas', norm: '1', eenheid: 'm²', prijs: '120.00' },
      { soort: 'arbeid', omschrijving: 'Glaszetter', norm: '0.9', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Zuignappen / gereedschap', norm: '1', eenheid: 'm²', prijs: '18.20' },
    ] },
    { omschrijving: 'Triple glas (vervangen beglazing)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '280.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Triple glas', norm: '1', eenheid: 'm²', prijs: '195.00' },
      { soort: 'arbeid', omschrijving: 'Glaszetter', norm: '1.0', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Glasrobot / gereedschap', norm: '1', eenheid: 'm²', prijs: '33.00' },
    ] },
    { omschrijving: 'Kruipruimte isolatie (folie + EPS)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '42.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Bodemfolie + EPS-bodemisolatie', norm: '1', eenheid: 'm²', prijs: '26.00' },
      { soort: 'arbeid', omschrijving: 'Isolatiemonteur', norm: '0.35', eenheid: 'uur', prijs: '42.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '1.30' },
    ] },
  ],

  Gevelrenovatie: [
    { omschrijving: 'Gevel reinigen (hogedrukreiniger)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '12.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'Gevelreiniger', norm: '0.2', eenheid: 'uur', prijs: '38.00' },
      { soort: 'materieel', omschrijving: 'Hogedrukunit / steiger', norm: '1', eenheid: 'm²', prijs: '3.40' },
      { soort: 'materiaal', omschrijving: 'Reinigingsmiddel', norm: '1', eenheid: 'm²', prijs: '1.00' },
    ] },
    { omschrijving: 'Gevelvoegen bijwerken', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '38.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Voegmortel', norm: '1', eenheid: 'm²', prijs: '8.00' },
      { soort: 'arbeid', omschrijving: 'Voeger', norm: '0.55', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Steiger', norm: '1', eenheid: 'm²', prijs: '4.70' },
    ] },
    { omschrijving: 'Betonherstel buitengevel', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '75.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Reparatiemortel + primer', norm: '1', eenheid: 'm²', prijs: '20.00' },
      { soort: 'arbeid', omschrijving: 'Betonhersteller', norm: '1', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Steiger', norm: '1', eenheid: 'm²', prijs: '9.00' },
    ] },
    { omschrijving: 'Gevelisolatie met pleisterlaag (ETICS-systeem)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '135.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Isolatieplaat + wapening + sierpleister', norm: '1', eenheid: 'm²', prijs: '64.00' },
      { soort: 'arbeid', omschrijving: 'Gevelisolatiemonteur', norm: '1.3', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Steiger', norm: '1', eenheid: 'm²', prijs: '11.20' },
    ] },
    { omschrijving: 'Gevelbekleding hout (siberisch lariks)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Lariks delen + regelwerk', norm: '1', eenheid: 'm²', prijs: '48.00' },
      { soort: 'arbeid', omschrijving: 'Timmerman', norm: '0.9', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Steiger', norm: '1', eenheid: 'm²', prijs: '5.60' },
    ] },
    { omschrijving: 'Gevelbekleding composiet / HPL', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '145.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'HPL-platen + onderconstructie', norm: '1', eenheid: 'm²', prijs: '88.00' },
      { soort: 'arbeid', omschrijving: 'Gevelmonteur', norm: '1.1', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Steiger', norm: '1', eenheid: 'm²', prijs: '6.40' },
    ] },
    { omschrijving: 'Gevelnet / klimop verwijderen', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '18.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'Gevelwerker', norm: '0.35', eenheid: 'uur', prijs: '38.00' },
      { soort: 'materieel', omschrijving: 'Steiger / gereedschap', norm: '1', eenheid: 'm²', prijs: '3.00' },
      { soort: 'onderaanneming', omschrijving: 'Afvoer groenafval', norm: '1', eenheid: 'm²', prijs: '1.70' },
    ] },
  ],

  'Kozijnen & Deuren': [
    { omschrijving: 'Kunststof raamkozijn HR++ glas', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1200.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Kunststof kozijn + HR++ glas + draaidelen', norm: '1', eenheid: 'st', prijs: '820.00' },
      { soort: 'arbeid', omschrijving: 'Kozijnmonteur', norm: '4', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Stelmateriaal / gereedschap', norm: '1', eenheid: 'st', prijs: '88.00' },
      { soort: 'onderaanneming', omschrijving: 'Afwerking / kitwerk', norm: '1', eenheid: 'st', prijs: '100.00' },
    ] },
    { omschrijving: 'Aluminium kozijn HR++ glas', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1650.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Aluminium kozijn + HR++ glas', norm: '1', eenheid: 'st', prijs: '1180.00' },
      { soort: 'arbeid', omschrijving: 'Kozijnmonteur', norm: '4.5', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Stelmateriaal / gereedschap', norm: '1', eenheid: 'st', prijs: '254.00' },
    ] },
    { omschrijving: 'Voordeur compleet (incl. hang- en sluitwerk)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '2800.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Voordeur + kozijn + hang- en sluitwerk', norm: '1', eenheid: 'st', prijs: '2050.00' },
      { soort: 'arbeid', omschrijving: 'Kozijnmonteur', norm: '8', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Stelmateriaal / gereedschap', norm: '1', eenheid: 'st', prijs: '366.00' },
    ] },
    { omschrijving: 'Achterdeur compleet (incl. kozijn)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '2200.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Achterdeur + kozijn + beslag', norm: '1', eenheid: 'st', prijs: '1580.00' },
      { soort: 'arbeid', omschrijving: 'Kozijnmonteur', norm: '7', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Stelmateriaal / gereedschap', norm: '1', eenheid: 'st', prijs: '284.00' },
    ] },
    { omschrijving: 'Binnendeur (incl. kozijn, hang- en sluitwerk)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '480.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Binnendeur + kozijn + beslag', norm: '1', eenheid: 'st', prijs: '320.00' },
      { soort: 'arbeid', omschrijving: 'Timmerman', norm: '2.5', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '40.00' },
    ] },
    { omschrijving: 'Schuifpui 2-delig aluminium HR++', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '3500.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Schuifpui 2-delig + HR++ glas', norm: '1', eenheid: 'st', prijs: '2600.00' },
      { soort: 'arbeid', omschrijving: 'Kozijnmonteur', norm: '12', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Glasrobot / gereedschap', norm: '1', eenheid: 'st', prijs: '324.00' },
    ] },
    { omschrijving: 'Schuifpui 3-delig aluminium HR++', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '5200.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Schuifpui 3-delig + HR++ glas', norm: '1', eenheid: 'st', prijs: '3900.00' },
      { soort: 'arbeid', omschrijving: 'Kozijnmonteur', norm: '16', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Glasrobot / gereedschap', norm: '1', eenheid: 'st', prijs: '532.00' },
    ] },
    { omschrijving: 'Garagedeur sectionaal (incl. motor)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '3800.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Sectionaaldeur + motor', norm: '1', eenheid: 'st', prijs: '2900.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '9', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '468.00' },
    ] },
    { omschrijving: 'Kozijnen kitten (buiten)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '65.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Kit', norm: '1', eenheid: 'st', prijs: '8.00' },
      { soort: 'arbeid', omschrijving: 'Kitter', norm: '1.1', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Ladder / gereedschap', norm: '1', eenheid: 'st', prijs: '4.20' },
    ] },
  ],

  'Stucwerk & Plafonds': [
    { omschrijving: 'Glad stucwerk wanden (2-laags)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '22.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Stucmortel', norm: '1', eenheid: 'm²', prijs: '4.00' },
      { soort: 'arbeid', omschrijving: 'Stukadoor', norm: '0.35', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '1.90' },
    ] },
    { omschrijving: 'Glad stucwerk plafond', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '28.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Stucmortel', norm: '1', eenheid: 'm²', prijs: '4.50' },
      { soort: 'arbeid', omschrijving: 'Stukadoor', norm: '0.45', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap / steiger', norm: '1', eenheid: 'm²', prijs: '2.80' },
    ] },
    { omschrijving: 'Buitengevel spachtelputz', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '45.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Spachtelputz + grondlaag', norm: '1', eenheid: 'm²', prijs: '12.00' },
      { soort: 'arbeid', omschrijving: 'Stukadoor', norm: '0.6', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Steiger', norm: '1', eenheid: 'm²', prijs: '5.40' },
    ] },
    { omschrijving: 'Cementdekvloer / egaline', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '35.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Dekvloermortel / egaline', norm: '1', eenheid: 'm²', prijs: '12.00' },
      { soort: 'arbeid', omschrijving: 'Vloerenlegger', norm: '0.4', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Meng- / pompmachine', norm: '1', eenheid: 'm²', prijs: '4.60' },
    ] },
    { omschrijving: 'Gipskarton wand op regelwerk', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '58.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Gipsplaten + metalstud-regels', norm: '1', eenheid: 'm²', prijs: '22.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '0.7', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '3.80' },
    ] },
    { omschrijving: 'Systeemplafond (600×600 cassettes)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '48.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Cassettes + draagprofielen', norm: '1', eenheid: 'm²', prijs: '26.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '0.45', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '1.30' },
    ] },
    { omschrijving: 'Gips scheidingswand (glaswol incl.)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '75.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Dubbele beplating + glaswol + regels', norm: '1', eenheid: 'm²', prijs: '34.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '0.8', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '4.20' },
    ] },
    { omschrijving: 'Corniche / plafondlijst stucwerk', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '32.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Sierlijst + lijm', norm: '1', eenheid: 'm¹', prijs: '10.00' },
      { soort: 'arbeid', omschrijving: 'Stukadoor', norm: '0.45', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '1.30' },
    ] },
  ],

  // Tegelwerk — showcase regel mét receptuur
  Tegelwerk: [
    {
      omschrijving: 'Wandtegels badkamer (incl. tegellijm en voeg)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '85.00',
      opbouw: [
        { soort: 'materiaal', omschrijving: 'Wandtegel keramisch',     norm: '1.05', eenheid: 'm²',  prijs: '32.00' },
        { soort: 'materiaal', omschrijving: 'Tegellijm',               norm: '4',    eenheid: 'kg',   prijs: '1.20' },
        { soort: 'materiaal', omschrijving: 'Voegmortel',              norm: '0.5',  eenheid: 'kg',   prijs: '2.40' },
        { soort: 'arbeid',    omschrijving: 'Tegelzetter',             norm: '0.85', eenheid: 'uur',  prijs: '46.00' },
      ],
    },
    { omschrijving: 'Vloertegels badkamer / toilet', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '78.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Vloertegel keramisch', norm: '1.05', eenheid: 'm²', prijs: '30.00' },
      { soort: 'materiaal', omschrijving: 'Tegellijm', norm: '4', eenheid: 'kg', prijs: '1.20' },
      { soort: 'materiaal', omschrijving: 'Voegmortel', norm: '0.5', eenheid: 'kg', prijs: '2.40' },
      { soort: 'arbeid', omschrijving: 'Tegelzetter', norm: '0.85', eenheid: 'uur', prijs: '46.00' },
    ] },
    { omschrijving: 'Vloertegels keuken / woonkamer', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '65.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Vloertegel keramisch', norm: '1.05', eenheid: 'm²', prijs: '24.00' },
      { soort: 'materiaal', omschrijving: 'Tegellijm + voeg', norm: '1', eenheid: 'm²', prijs: '6.00' },
      { soort: 'arbeid', omschrijving: 'Tegelzetter', norm: '0.72', eenheid: 'uur', prijs: '46.00' },
    ] },
    { omschrijving: 'Grote formaat tegel ≥60×60 cm', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '110.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Grootformaat tegel', norm: '1.05', eenheid: 'm²', prijs: '62.00' },
      { soort: 'materiaal', omschrijving: 'Flexlijm + voeg', norm: '1', eenheid: 'm²', prijs: '9.00' },
      { soort: 'arbeid', omschrijving: 'Tegelzetter', norm: '0.78', eenheid: 'uur', prijs: '46.00' },
    ] },
    { omschrijving: 'Cementlook vloertegel', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '98.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Cementlook tegel', norm: '1.05', eenheid: 'm²', prijs: '52.00' },
      { soort: 'materiaal', omschrijving: 'Lijm + voeg', norm: '1', eenheid: 'm²', prijs: '8.00' },
      { soort: 'arbeid', omschrijving: 'Tegelzetter', norm: '0.82', eenheid: 'uur', prijs: '46.00' },
    ] },
    { omschrijving: 'Mozaïektegels', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '145.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Mozaïektegel op net', norm: '1.05', eenheid: 'm²', prijs: '88.00' },
      { soort: 'materiaal', omschrijving: 'Lijm + voeg', norm: '1', eenheid: 'm²', prijs: '7.00' },
      { soort: 'arbeid', omschrijving: 'Tegelzetter', norm: '1.0', eenheid: 'uur', prijs: '46.00' },
    ] },
    { omschrijving: 'Tegelplint (5 cm)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '28.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Plinttegel + lijm', norm: '1', eenheid: 'm¹', prijs: '9.50' },
      { soort: 'arbeid', omschrijving: 'Tegelzetter', norm: '0.4', eenheid: 'uur', prijs: '46.00' },
    ] },
    { omschrijving: 'Bestaande tegels verwijderen (incl. afvoer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '22.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'Sloper', norm: '0.4', eenheid: 'uur', prijs: '42.00' },
      { soort: 'materieel', omschrijving: 'Breekhamer', norm: '1', eenheid: 'm²', prijs: '2.20' },
      { soort: 'onderaanneming', omschrijving: 'Afvoer puin', norm: '1', eenheid: 'm²', prijs: '3.00' },
    ] },
  ],

  Vloerwerk: [
    { omschrijving: 'Laminaatvloer leggen (incl. ondervloer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '28.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Laminaat + ondervloer + plinten', norm: '1', eenheid: 'm²', prijs: '16.00' },
      { soort: 'arbeid', omschrijving: 'Vloerenlegger', norm: '0.25', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '0.50' },
    ] },
    { omschrijving: 'PVC-vloer leggen (incl. ondervloer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '32.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'PVC-vloer + ondervloer + lijm', norm: '1', eenheid: 'm²', prijs: '19.00' },
      { soort: 'arbeid', omschrijving: 'Vloerenlegger', norm: '0.27', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '0.58' },
    ] },
    { omschrijving: 'Parketvloer leggen (incl. schuren en lakken)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '65.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Parket + lijm + lak', norm: '1', eenheid: 'm²', prijs: '34.00' },
      { soort: 'arbeid', omschrijving: 'Parketteur', norm: '0.6', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Schuurmachine', norm: '1', eenheid: 'm²', prijs: '2.20' },
    ] },
    { omschrijving: 'Houten vloer schuren en lakken (bestaand)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '28.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Lak / olie', norm: '1', eenheid: 'm²', prijs: '6.00' },
      { soort: 'arbeid', omschrijving: 'Parketteur', norm: '0.4', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Schuurmachine', norm: '1', eenheid: 'm²', prijs: '2.80' },
    ] },
    { omschrijving: 'Gietvloer / Ardex woonkamer', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Gietvloersysteem + primer', norm: '1', eenheid: 'm²', prijs: '38.00' },
      { soort: 'arbeid', omschrijving: 'Gietvloerspecialist', norm: '1.0', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Menger / spaan', norm: '1', eenheid: 'm²', prijs: '9.00' },
    ] },
    { omschrijving: 'Betonlook gietvloer (2-laags)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '110.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Betonlook systeem + coating', norm: '1', eenheid: 'm²', prijs: '46.00' },
      { soort: 'arbeid', omschrijving: 'Gietvloerspecialist', norm: '1.1', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '11.20' },
    ] },
    { omschrijving: 'Epoxyvloer (garage / bedrijfsruimte)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '45.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Epoxy + primer', norm: '1', eenheid: 'm²', prijs: '22.00' },
      { soort: 'arbeid', omschrijving: 'Coatingspecialist', norm: '0.45', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '2.30' },
    ] },
    { omschrijving: 'Tapijt leggen (incl. vilt)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '22.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Tapijt + vilt + lijm', norm: '1', eenheid: 'm²', prijs: '13.00' },
      { soort: 'arbeid', omschrijving: 'Vloerenlegger', norm: '0.2', eenheid: 'uur', prijs: '42.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '0.60' },
    ] },
    { omschrijving: 'Plinten MDF lakken en plaatsen', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '18.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'MDF-plint gelakt', norm: '1', eenheid: 'm¹', prijs: '6.00' },
      { soort: 'arbeid', omschrijving: 'Timmerman', norm: '0.25', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '0.50' },
    ] },
  ],

  Schilderwerk: [
    { omschrijving: 'Binnenwanden schilderwerk (2 lagen verf)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '12.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Muurverf', norm: '1', eenheid: 'm²', prijs: '3.00' },
      { soort: 'arbeid', omschrijving: 'Schilder', norm: '0.18', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '0.72' },
    ] },
    { omschrijving: 'Plafonds schilderwerk', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '15.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Plafondverf', norm: '1', eenheid: 'm²', prijs: '3.50' },
      { soort: 'arbeid', omschrijving: 'Schilder', norm: '0.23', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '0.92' },
    ] },
    { omschrijving: 'Kozijnen buiten schilderwerk', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '280.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Grondverf + lakverf', norm: '1', eenheid: 'st', prijs: '40.00' },
      { soort: 'arbeid', omschrijving: 'Schilder', norm: '5', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Ladder / gereedschap', norm: '1', eenheid: 'st', prijs: '10.00' },
    ] },
    { omschrijving: 'Deuren schilderwerk (2 zijden)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '145.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Grondverf + lakverf', norm: '1', eenheid: 'st', prijs: '25.00' },
      { soort: 'arbeid', omschrijving: 'Schilder', norm: '2.5', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '5.00' },
    ] },
    { omschrijving: 'Behangen wanden', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '25.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Behang + lijm', norm: '1', eenheid: 'm²', prijs: '9.00' },
      { soort: 'arbeid', omschrijving: 'Behanger', norm: '0.32', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '1.28' },
    ] },
    { omschrijving: 'Houtrot herstel kozijn (inclusief kit)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '180.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Reparatie-epoxy + kit', norm: '1', eenheid: 'st', prijs: '35.00' },
      { soort: 'arbeid', omschrijving: 'Schilder/timmerman', norm: '3', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '7.00' },
    ] },
    { omschrijving: 'Beitswerk hout buiten', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '22.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Beits', norm: '1', eenheid: 'm²', prijs: '5.00' },
      { soort: 'arbeid', omschrijving: 'Schilder', norm: '0.35', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '0.90' },
    ] },
    { omschrijving: 'Grondverf / primer aanbrengen', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '8.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Primer', norm: '1', eenheid: 'm²', prijs: '2.50' },
      { soort: 'arbeid', omschrijving: 'Schilder', norm: '0.11', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '0.44' },
    ] },
  ],

  Timmerwerk: [
    { omschrijving: 'Plinten plaatsen (MDF, lakklaar)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '18.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'MDF-plint lakklaar', norm: '1', eenheid: 'm¹', prijs: '6.00' },
      { soort: 'arbeid', omschrijving: 'Timmerman', norm: '0.25', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '0.50' },
    ] },
    { omschrijving: 'Dorpels plaatsen', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '95.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Dorpel (kunststeen/hout)', norm: '1', eenheid: 'st', prijs: '45.00' },
      { soort: 'arbeid', omschrijving: 'Timmerman', norm: '1', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '4.00' },
    ] },
    { omschrijving: 'Kozijnen repareren / kitten', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '145.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Reparatiemateriaal + kit', norm: '1', eenheid: 'st', prijs: '25.00' },
      { soort: 'arbeid', omschrijving: 'Timmerman', norm: '2.5', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '5.00' },
    ] },
    { omschrijving: 'Wandpanelen / lambrisering (MDF)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '68.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'MDF-panelen + bevestiging', norm: '1', eenheid: 'm²', prijs: '30.00' },
      { soort: 'arbeid', omschrijving: 'Timmerman', norm: '0.8', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '1.20' },
    ] },
    { omschrijving: 'Trapleuning monteren', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '85.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Leuning + dragers', norm: '1', eenheid: 'm¹', prijs: '38.00' },
      { soort: 'arbeid', omschrijving: 'Timmerman', norm: '1', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '1.00' },
    ] },
    { omschrijving: 'Houten vliesgevel (incl. regelwerk)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '110.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Houtdelen + regelwerk', norm: '1', eenheid: 'm²', prijs: '58.00' },
      { soort: 'arbeid', omschrijving: 'Timmerman', norm: '1.1', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '1.40' },
    ] },
    { omschrijving: 'Koof / afwerking verborgen leiding', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '55.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Plaatmateriaal + regels', norm: '1', eenheid: 'm¹', prijs: '18.00' },
      { soort: 'arbeid', omschrijving: 'Timmerman', norm: '0.8', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '0.20' },
    ] },
    { omschrijving: 'Maatwerk kastruimte / berging', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '2500.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Plaatmateriaal + beslag', norm: '1', eenheid: 'ls', prijs: '1200.00' },
      { soort: 'arbeid', omschrijving: 'Meubelmaker', norm: '28', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'ls', prijs: '12.00' },
    ] },
  ],

  // Elektra — showcase regel mét receptuur
  Elektra: [
    {
      omschrijving: 'Groep (incl. leiding, buis, aansluiting)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '380.00',
      opbouw: [
        { soort: 'materiaal', omschrijving: 'Installatieautomaat 16A',  norm: '1',  eenheid: 'st',  prijs: '18.00' },
        { soort: 'materiaal', omschrijving: 'Installatiedraad 3×2,5 mm²', norm: '18', eenheid: 'm¹', prijs: '1.10' },
        { soort: 'materiaal', omschrijving: 'Installatiebuis + montage',  norm: '15', eenheid: 'm¹', prijs: '0.90' },
        { soort: 'arbeid',    omschrijving: 'Elektromonteur',            norm: '4',  eenheid: 'uur', prijs: '52.00' },
      ],
    },
    { omschrijving: 'Wandcontactdoos enkel', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '85.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'WCD + inbouwdoos + draad', norm: '1', eenheid: 'st', prijs: '18.00' },
      { soort: 'arbeid', omschrijving: 'Elektromonteur', norm: '1.2', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '4.60' },
    ] },
    { omschrijving: 'Wandcontactdoos dubbel', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '115.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Dubbele WCD + doos + draad', norm: '1', eenheid: 'st', prijs: '28.00' },
      { soort: 'arbeid', omschrijving: 'Elektromonteur', norm: '1.6', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '3.80' },
    ] },
    { omschrijving: 'LED-inbouwarmatuur', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '145.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'LED-armatuur', norm: '1', eenheid: 'st', prijs: '85.00' },
      { soort: 'arbeid', omschrijving: 'Elektromonteur', norm: '1', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '8.00' },
    ] },
    { omschrijving: 'Meterkast vernieuwen (16-groepen)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1250.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Kast + automaten + aardlekschakelaars', norm: '1', eenheid: 'st', prijs: '620.00' },
      { soort: 'arbeid', omschrijving: 'Elektromonteur', norm: '11', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '58.00' },
    ] },
    { omschrijving: 'Meterkast uitbreiden (per groep)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '195.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Automaat + bedrading', norm: '1', eenheid: 'st', prijs: '45.00' },
      { soort: 'arbeid', omschrijving: 'Elektromonteur', norm: '2.8', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '4.40' },
    ] },
    { omschrijving: 'Laadpaal EV thuis (incl. groep + aansluiting)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1850.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Laadpaal + groep + kabel', norm: '1', eenheid: 'st', prijs: '1150.00' },
      { soort: 'arbeid', omschrijving: 'Elektromonteur', norm: '12', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '76.00' },
    ] },
    { omschrijving: 'TV/data-aansluiting CAT6', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '125.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'CAT6-kabel + wandcontact', norm: '1', eenheid: 'st', prijs: '35.00' },
      { soort: 'arbeid', omschrijving: 'Elektromonteur', norm: '1.6', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '6.80' },
    ] },
    { omschrijving: 'Buitenlamp / buitenstopcontact', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '165.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Buitenarmatuur / WCD IP44', norm: '1', eenheid: 'st', prijs: '65.00' },
      { soort: 'arbeid', omschrijving: 'Elektromonteur', norm: '1.8', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '6.40' },
    ] },
    { omschrijving: 'Domotica schakelaar / dimmer', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '285.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Domoticamodule + schakelaar', norm: '1', eenheid: 'st', prijs: '175.00' },
      { soort: 'arbeid', omschrijving: 'Elektromonteur', norm: '2', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '6.00' },
    ] },
    { omschrijving: 'Rookmelder plaatsen', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '85.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Gekoppelde rookmelder', norm: '1', eenheid: 'st', prijs: '35.00' },
      { soort: 'arbeid', omschrijving: 'Elektromonteur', norm: '0.9', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '3.20' },
    ] },
  ],

  Loodgieterij: [
    { omschrijving: 'Aansluitpunt warm- en koudwaterleiding', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '245.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Leiding + fittingen + isolatie', norm: '1', eenheid: 'st', prijs: '85.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '3', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '4.00' },
    ] },
    { omschrijving: 'Inloopdouche compleet (incl. kraan)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1850.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Douchegarnituur + kraan + afvoergoot', norm: '1', eenheid: 'st', prijs: '1150.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '12', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '76.00' },
    ] },
    { omschrijving: 'Toilet compleet (incl. reservoir en zitting)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '680.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Toilet + inbouwreservoir + zitting', norm: '1', eenheid: 'st', prijs: '420.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '4.5', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '26.00' },
    ] },
    { omschrijving: 'Wastafel incl. kraan en sifon', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '520.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Wastafel + kraan + sifon', norm: '1', eenheid: 'st', prijs: '320.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '3.5', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '18.00' },
    ] },
    { omschrijving: 'Ligbad incl. kraan (ingebouwd)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '2850.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Bad + kraan + opbouwframe', norm: '1', eenheid: 'st', prijs: '1850.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '16', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '168.00' },
    ] },
    { omschrijving: 'Radiator aansluiten (incl. thermostaatknop)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '320.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Radiator + kraanwerk', norm: '1', eenheid: 'st', prijs: '180.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '2.5', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '10.00' },
    ] },
    { omschrijving: 'Vloerverwarming (incl. verdeler)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '55.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Leiding + verdeler (aandeel)', norm: '1', eenheid: 'm²', prijs: '28.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '0.5', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '1.00' },
    ] },
    { omschrijving: 'Buitenkraan aansluiten', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '185.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Vorstvrije buitenkraan + leiding', norm: '1', eenheid: 'st', prijs: '65.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '2.2', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '5.60' },
    ] },
    { omschrijving: 'Wasmachineaansluiting (warm, koud, afvoer)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '245.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Aansluitset + afvoer', norm: '1', eenheid: 'st', prijs: '85.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '3', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '4.00' },
    ] },
    { omschrijving: 'Waterleiding doortrekken (per m¹)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '42.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Leiding + fittingen', norm: '1', eenheid: 'm¹', prijs: '16.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '0.5', eenheid: 'uur', prijs: '52.00' },
    ] },
  ],

  'CV-installatie': [
    { omschrijving: 'CV-ketel vervangen (combiketel, incl. montage)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '3200.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Combiketel HR', norm: '1', eenheid: 'st', prijs: '2200.00' },
      { soort: 'materiaal', omschrijving: 'Aansluitmateriaal + rookgasafvoer', norm: '1', eenheid: 'st', prijs: '180.00' },
      { soort: 'arbeid', omschrijving: 'CV-monteur', norm: '12', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '196.00' },
    ] },
    { omschrijving: 'Warmtepomp lucht/water aansluiten', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '8500.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Warmtepomp + buffervat', norm: '1', eenheid: 'st', prijs: '5800.00' },
      { soort: 'arbeid', omschrijving: 'WP-monteur', norm: '32', eenheid: 'uur', prijs: '55.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap / hijswerk', norm: '1', eenheid: 'st', prijs: '940.00' },
    ] },
    { omschrijving: 'Hybride warmtepomp (incl. ketel)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '6800.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Hybride WP + combiketel', norm: '1', eenheid: 'st', prijs: '4600.00' },
      { soort: 'arbeid', omschrijving: 'WP-monteur', norm: '26', eenheid: 'uur', prijs: '55.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '770.00' },
    ] },
    { omschrijving: 'Radiator vervangen (incl. ontluchten)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '385.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Radiator + koppelingen', norm: '1', eenheid: 'st', prijs: '210.00' },
      { soort: 'arbeid', omschrijving: 'CV-monteur', norm: '3', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '19.00' },
    ] },
    { omschrijving: 'CV-leiding aanleggen (per m¹, inbouw)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '48.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Leiding + isolatie + fittingen', norm: '1', eenheid: 'm¹', prijs: '18.00' },
      { soort: 'arbeid', omschrijving: 'CV-monteur', norm: '0.55', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '1.40' },
    ] },
    { omschrijving: 'Thermostaatventiel vervangen', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '95.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Thermostaatventiel', norm: '1', eenheid: 'st', prijs: '35.00' },
      { soort: 'arbeid', omschrijving: 'CV-monteur', norm: '1.1', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '2.80' },
    ] },
    { omschrijving: 'CV-installatie onderhoud / service', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '285.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'Servicemonteur', norm: '4', eenheid: 'uur', prijs: '55.00' },
      { soort: 'materiaal', omschrijving: 'Onderdelen / afdichtingen', norm: '1', eenheid: 'ls', prijs: '45.00' },
      { soort: 'materieel', omschrijving: 'Meetapparatuur', norm: '1', eenheid: 'ls', prijs: '20.00' },
    ] },
    { omschrijving: 'Expansievat vervangen', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '280.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Expansievat', norm: '1', eenheid: 'st', prijs: '95.00' },
      { soort: 'arbeid', omschrijving: 'CV-monteur', norm: '3.2', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '18.60' },
    ] },
  ],

  'Ventilatie & WTW': [
    { omschrijving: 'Mechanische ventilatie-unit (badkamer/toilet)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '380.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Ventilatiebox + aansluitmateriaal', norm: '1', eenheid: 'st', prijs: '180.00' },
      { soort: 'arbeid', omschrijving: 'Installateur', norm: '3.5', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '18.00' },
    ] },
    { omschrijving: 'WTW-unit plaatsen (incl. aansluiting)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '2850.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'WTW-unit', norm: '1', eenheid: 'st', prijs: '1850.00' },
      { soort: 'arbeid', omschrijving: 'Installateur', norm: '16', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '168.00' },
    ] },
    { omschrijving: 'WTW-systeem compleet (unit + kanalen + roosters)', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '5800.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Unit + kanalen + roosters', norm: '1', eenheid: 'ls', prijs: '3600.00' },
      { soort: 'arbeid', omschrijving: 'Installateur', norm: '38', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'ls', prijs: '224.00' },
    ] },
    { omschrijving: 'Kanaalwerk ventilatiesysteem (per m¹)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '38.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Kanaal + isolatie + bevestiging', norm: '1', eenheid: 'm¹', prijs: '16.00' },
      { soort: 'arbeid', omschrijving: 'Installateur', norm: '0.4', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '1.20' },
    ] },
    { omschrijving: 'Ventilatieroosters plaatsen', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '95.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Ventilatierooster', norm: '1', eenheid: 'st', prijs: '45.00' },
      { soort: 'arbeid', omschrijving: 'Installateur', norm: '0.9', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '3.20' },
    ] },
    { omschrijving: 'Dakdoorvoer ventilatie', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '285.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Dakdoorvoer + pan/manchet', norm: '1', eenheid: 'st', prijs: '120.00' },
      { soort: 'arbeid', omschrijving: 'Dakdekker', norm: '3', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Steiger / gereedschap', norm: '1', eenheid: 'st', prijs: '9.00' },
    ] },
    { omschrijving: 'Balansventilatie filter vervangen', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '85.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Filterset', norm: '1', eenheid: 'ls', prijs: '45.00' },
      { soort: 'arbeid', omschrijving: 'Servicemonteur', norm: '0.7', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'ls', prijs: '3.60' },
    ] },
  ],

  Zonnepanelen: [
    { omschrijving: 'Zonnepaneel 400-430 Wp (incl. montage op dak)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '580.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Paneel + montagesysteem', norm: '1', eenheid: 'st', prijs: '360.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '3', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Steiger / gereedschap', norm: '1', eenheid: 'st', prijs: '76.00' },
    ] },
    { omschrijving: 'Zonnepaneel 450-500 Wp premium', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '720.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Premiumpaneel + montagesysteem', norm: '1', eenheid: 'st', prijs: '460.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '3.2', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Steiger / gereedschap', norm: '1', eenheid: 'st', prijs: '106.40' },
    ] },
    { omschrijving: 'Micro-omvormer per paneel', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '185.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Micro-omvormer', norm: '1', eenheid: 'st', prijs: '125.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '1', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '12.00' },
    ] },
    { omschrijving: 'String-omvormer 3-fase (incl. installatie)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1850.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'String-omvormer 3-fase', norm: '1', eenheid: 'st', prijs: '1250.00' },
      { soort: 'arbeid', omschrijving: 'Elektromonteur', norm: '8', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '184.00' },
    ] },
    { omschrijving: 'DC-bekabeling en kabelgoten', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '380.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'DC-kabel + connectoren + goten', norm: '1', eenheid: 'ls', prijs: '180.00' },
      { soort: 'arbeid', omschrijving: 'Elektromonteur', norm: '3.5', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'ls', prijs: '18.00' },
    ] },
    { omschrijving: 'Thuisbatterij 5 kWh (incl. installatie)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '5800.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Thuisbatterij 5 kWh', norm: '1', eenheid: 'st', prijs: '4200.00' },
      { soort: 'arbeid', omschrijving: 'Elektromonteur', norm: '16', eenheid: 'uur', prijs: '55.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '720.00' },
    ] },
    { omschrijving: 'Steiger dagwerk (voor paneelmontage)', hoeveelheid: '', eenheid: 'dag', eenheidsprijs: '450.00', opbouw: [
      { soort: 'materieel', omschrijving: 'Steiger (dagtarief)', norm: '1', eenheid: 'dag', prijs: '280.00' },
      { soort: 'arbeid', omschrijving: 'Op- en afbouw steiger', norm: '3', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materiaal', omschrijving: 'Bevestiging / hekken', norm: '1', eenheid: 'dag', prijs: '26.00' },
    ] },
  ],

  'Badkamer compleet': [
    { omschrijving: 'Sloop badkamer compleet', hoeveelheid: '1', eenheid: 'ls', eenheidsprijs: '850.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'Sloper', norm: '16', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap / bescherming', norm: '1', eenheid: 'ls', prijs: '80.00' },
      { soort: 'onderaanneming', omschrijving: 'Afvoer en stortkosten', norm: '1', eenheid: 'ls', prijs: '130.00' },
    ] },
    { omschrijving: 'Wandtegels badkamer', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '85.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Wandtegel keramisch', norm: '1.05', eenheid: 'm²', prijs: '32.00' },
      { soort: 'materiaal', omschrijving: 'Tegellijm + voeg', norm: '1', eenheid: 'm²', prijs: '6.00' },
      { soort: 'arbeid', omschrijving: 'Tegelzetter', norm: '0.85', eenheid: 'uur', prijs: '46.00' },
    ] },
    { omschrijving: 'Vloertegels badkamer', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '78.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Vloertegel keramisch', norm: '1.05', eenheid: 'm²', prijs: '30.00' },
      { soort: 'materiaal', omschrijving: 'Tegellijm + voeg', norm: '1', eenheid: 'm²', prijs: '6.00' },
      { soort: 'arbeid', omschrijving: 'Tegelzetter', norm: '0.85', eenheid: 'uur', prijs: '46.00' },
    ] },
    { omschrijving: 'Inloopdouche compleet (incl. kraan)', hoeveelheid: '1', eenheid: 'st', eenheidsprijs: '1850.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Douchegarnituur + kraan + afvoergoot', norm: '1', eenheid: 'st', prijs: '1150.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '12', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '76.00' },
    ] },
    { omschrijving: 'Toilet compleet (incl. reservoir)', hoeveelheid: '1', eenheid: 'st', eenheidsprijs: '680.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Toilet + inbouwreservoir + zitting', norm: '1', eenheid: 'st', prijs: '420.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '4.5', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '26.00' },
    ] },
    { omschrijving: 'Wastafel incl. kraan en sifon', hoeveelheid: '1', eenheid: 'st', eenheidsprijs: '520.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Wastafel + kraan + sifon', norm: '1', eenheid: 'st', prijs: '320.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '3.5', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '18.00' },
    ] },
    { omschrijving: 'Loodgieterij aansluitpunten', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '245.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Leiding + fittingen', norm: '1', eenheid: 'st', prijs: '85.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '3', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '4.00' },
    ] },
    { omschrijving: 'Glad stucwerk resterende wanden', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '22.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Stucmortel', norm: '1', eenheid: 'm²', prijs: '4.00' },
      { soort: 'arbeid', omschrijving: 'Stukadoor', norm: '0.35', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '1.90' },
    ] },
    { omschrijving: 'Elektrische groep badkamer', hoeveelheid: '1', eenheid: 'st', eenheidsprijs: '380.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Automaat + leiding + buis', norm: '1', eenheid: 'st', prijs: '95.00' },
      { soort: 'arbeid', omschrijving: 'Elektromonteur', norm: '4.5', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '51.00' },
    ] },
  ],

  Keukenplaatsing: [
    { omschrijving: 'Demonteren bestaande keuken (incl. afvoer)', hoeveelheid: '1', eenheid: 'ls', eenheidsprijs: '580.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '8', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'ls', prijs: '60.00' },
      { soort: 'onderaanneming', omschrijving: 'Afvoer en stortkosten', norm: '1', eenheid: 'ls', prijs: '200.00' },
    ] },
    { omschrijving: 'Monteren nieuwe keukenblokken (incl. stellage)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '185.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Bevestiging / stelpoten', norm: '1', eenheid: 'm¹', prijs: '25.00' },
      { soort: 'arbeid', omschrijving: 'Keukenmonteur', norm: '3', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '16.00' },
    ] },
    { omschrijving: 'Aanrechtblad opmeten en monteren', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '145.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Bevestigingsmateriaal', norm: '1', eenheid: 'm¹', prijs: '35.00' },
      { soort: 'arbeid', omschrijving: 'Keukenmonteur', norm: '2.2', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '4.40' },
    ] },
    { omschrijving: 'Inbouwapparatuur aansluiten (elektra)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '145.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Aansluitmateriaal', norm: '1', eenheid: 'st', prijs: '25.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '2.2', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '5.60' },
    ] },
    { omschrijving: 'Gootsteen / kraan aansluiten', hoeveelheid: '1', eenheid: 'st', eenheidsprijs: '245.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Sifon + aansluitslangen', norm: '1', eenheid: 'st', prijs: '95.00' },
      { soort: 'arbeid', omschrijving: 'Loodgieter', norm: '2.8', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '4.40' },
    ] },
    { omschrijving: 'Keuken kitten (achter- en bovenzijde)', hoeveelheid: '1', eenheid: 'ls', eenheidsprijs: '185.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Kit', norm: '1', eenheid: 'ls', prijs: '20.00' },
      { soort: 'arbeid', omschrijving: 'Kitter', norm: '3.5', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'ls', prijs: '4.00' },
    ] },
    { omschrijving: 'Spatwand tegels', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '85.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Tegel + lijm + voeg', norm: '1', eenheid: 'm²', prijs: '38.00' },
      { soort: 'arbeid', omschrijving: 'Tegelzetter', norm: '0.85', eenheid: 'uur', prijs: '46.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '7.90' },
    ] },
    { omschrijving: 'Afzuigkap aansluiten (incl. kanaal)', hoeveelheid: '1', eenheid: 'st', eenheidsprijs: '320.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Afvoerkanaal + muurdoorvoer', norm: '1', eenheid: 'st', prijs: '120.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '3.5', eenheid: 'uur', prijs: '52.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '18.00' },
    ] },
  ],

  'Trap & Balustrade': [
    { omschrijving: 'Houten rechte trap compleet (incl. plaatsing)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '3800.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Houten rechte trap op maat', norm: '1', eenheid: 'st', prijs: '2400.00' },
      { soort: 'arbeid', omschrijving: 'Trappenmaker', norm: '18', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '536.00' },
    ] },
    { omschrijving: 'Kwartslag trap hout compleet', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '5500.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Kwartslag trap op maat', norm: '1', eenheid: 'st', prijs: '3600.00' },
      { soort: 'arbeid', omschrijving: 'Trappenmaker', norm: '26', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '652.00' },
    ] },
    { omschrijving: 'Trap renoveren (nieuwe bekleding op bestaand)', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '1850.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Bekledingsset (PVC/hout)', norm: '1', eenheid: 'ls', prijs: '950.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '16', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'ls', prijs: '132.00' },
    ] },
    { omschrijving: 'Stalen leuning / balustrade (incl. montage)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '320.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Stalen balustrade', norm: '1', eenheid: 'm¹', prijs: '185.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '2.5', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '15.00' },
    ] },
    { omschrijving: 'RVS spijlenbalustrade', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '485.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'RVS spijlenbalustrade', norm: '1', eenheid: 'm¹', prijs: '320.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '3.2', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '11.40' },
    ] },
    { omschrijving: 'Houten trapleuning', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '95.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Houten leuning + dragers', norm: '1', eenheid: 'm¹', prijs: '42.00' },
      { soort: 'arbeid', omschrijving: 'Timmerman', norm: '1.1', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '0.20' },
    ] },
    { omschrijving: 'Glazen balustrade (incl. profielen)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '650.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Gelaagd glas + klemprofielen', norm: '1', eenheid: 'm¹', prijs: '460.00' },
      { soort: 'arbeid', omschrijving: 'Glasmonteur', norm: '3.8', eenheid: 'uur', prijs: '48.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '7.60' },
    ] },
  ],

  'Bestrating & Terras': [
    { omschrijving: 'Betonstraatstenen 21×10 (incl. zandbed)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '42.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Betonstraatstenen + straatzand', norm: '1', eenheid: 'm²', prijs: '18.00' },
      { soort: 'arbeid', omschrijving: 'Straatmaker', norm: '0.5', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Trilplaat', norm: '1', eenheid: 'm²', prijs: '4.00' },
    ] },
    { omschrijving: 'Betontegels 50×50 cm (incl. zandbed)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '48.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Betontegels + zand', norm: '1', eenheid: 'm²', prijs: '22.00' },
      { soort: 'arbeid', omschrijving: 'Straatmaker', norm: '0.5', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Trilplaat', norm: '1', eenheid: 'm²', prijs: '6.00' },
    ] },
    { omschrijving: 'Klinkers roodbruin (incl. zandbed)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '55.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Gebakken klinkers + zand', norm: '1', eenheid: 'm²', prijs: '26.00' },
      { soort: 'arbeid', omschrijving: 'Straatmaker', norm: '0.6', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Trilplaat', norm: '1', eenheid: 'm²', prijs: '5.00' },
    ] },
    { omschrijving: 'Oprit gravel / steenslag', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '28.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Grind / steenslag + worteldoek', norm: '1', eenheid: 'm²', prijs: '14.00' },
      { soort: 'arbeid', omschrijving: 'Grondwerker', norm: '0.3', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Trilplaat', norm: '1', eenheid: 'm²', prijs: '2.00' },
    ] },
    { omschrijving: 'Terrasplaten 60×60 (incl. tegelvoeters)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '75.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Terrasplaten + tegelvoeters', norm: '1', eenheid: 'm²', prijs: '46.00' },
      { soort: 'arbeid', omschrijving: 'Stratenmaker', norm: '0.65', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '3.00' },
    ] },
    { omschrijving: 'Houten vlonder terras (bangkirai)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Bangkirai planken + onderregels', norm: '1', eenheid: 'm²', prijs: '58.00' },
      { soort: 'arbeid', omschrijving: 'Timmerman', norm: '0.85', eenheid: 'uur', prijs: '42.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '1.30' },
    ] },
    { omschrijving: 'Drainage goot plaatsen (incl. rooster)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '68.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Lijngoot + rooster', norm: '1', eenheid: 'm¹', prijs: '38.00' },
      { soort: 'arbeid', omschrijving: 'Straatmaker', norm: '0.6', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '6.00' },
    ] },
    { omschrijving: 'Opsluitband plaatsen', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '28.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Opsluitband + betonspecie', norm: '1', eenheid: 'm¹', prijs: '12.00' },
      { soort: 'arbeid', omschrijving: 'Straatmaker', norm: '0.35', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '2.00' },
    ] },
    { omschrijving: 'Bestaande bestrating opbreken en afvoeren', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '18.00', opbouw: [
      { soort: 'arbeid', omschrijving: 'Straatmaker', norm: '0.3', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm²', prijs: '2.40' },
      { soort: 'onderaanneming', omschrijving: 'Afvoer en verwerking', norm: '1', eenheid: 'm²', prijs: '3.60' },
    ] },
  ],

  Tuinafscheiding: [
    { omschrijving: 'Betonnen tuinpaal (incl. fundering)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '65.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Betonpaal + snelbeton', norm: '1', eenheid: 'st', prijs: '32.00' },
      { soort: 'arbeid', omschrijving: 'Hovenier', norm: '0.7', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '5.00' },
    ] },
    { omschrijving: 'Schutting hout gedompeld (incl. palen)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '95.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Schermen + palen + beton', norm: '1', eenheid: 'm¹', prijs: '52.00' },
      { soort: 'arbeid', omschrijving: 'Hovenier', norm: '0.9', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '7.00' },
    ] },
    { omschrijving: 'Schutting beton (incl. palen)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '120.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Betonschutting + palen', norm: '1', eenheid: 'm¹', prijs: '72.00' },
      { soort: 'arbeid', omschrijving: 'Hovenier', norm: '1', eenheid: 'uur', prijs: '40.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap / kraantje', norm: '1', eenheid: 'm¹', prijs: '8.00' },
    ] },
    { omschrijving: 'Hekwerk staal verzinkt', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '185.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Verzinkt hekwerk + palen', norm: '1', eenheid: 'm¹', prijs: '120.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '1.4', eenheid: 'uur', prijs: '42.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '6.20' },
    ] },
    { omschrijving: 'Poort staal (incl. montage)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '950.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Stalen poort + scharnieren + slot', norm: '1', eenheid: 'st', prijs: '620.00' },
      { soort: 'arbeid', omschrijving: 'Monteur', norm: '6', eenheid: 'uur', prijs: '42.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'st', prijs: '78.00' },
    ] },
    { omschrijving: 'Haag planten (carpinus, per m¹)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '48.00', opbouw: [
      { soort: 'materiaal', omschrijving: 'Haagplanten + grond/compost', norm: '1', eenheid: 'm¹', prijs: '28.00' },
      { soort: 'arbeid', omschrijving: 'Hovenier', norm: '0.5', eenheid: 'uur', prijs: '38.00' },
      { soort: 'materieel', omschrijving: 'Gereedschap', norm: '1', eenheid: 'm¹', prijs: '1.00' },
    ] },
  ],
}

// ─── Combi-groepen ────────────────────────────────────────────────────────────

const COMBI_GROEPEN: { label: string; emoji: string; items: string[] }[] = [
  { label: 'Ruwbouw',           emoji: '🏗', items: ['Sloopwerk', 'Fundering & Grondwerk', 'Metselwerk', 'Betonwerk', 'Riolering', 'Asbestsanering'] },
  { label: 'Dak',               emoji: '🏠', items: ['Dakwerk', 'Dakkapel & Dakraam', 'Isolatie'] },
  { label: 'Gevel & Kozijnen',  emoji: '🪟', items: ['Gevelrenovatie', 'Kozijnen & Deuren'] },
  { label: 'Afbouw',            emoji: '🛁', items: ['Stucwerk & Plafonds', 'Tegelwerk', 'Vloerwerk', 'Schilderwerk', 'Timmerwerk'] },
  { label: 'Installaties',      emoji: '⚡', items: ['Elektra', 'Loodgieterij', 'CV-installatie', 'Ventilatie & WTW', 'Zonnepanelen'] },
  { label: 'Complete verbouw',  emoji: '🔧', items: ['Badkamer compleet', 'Keukenplaatsing', 'Trap & Balustrade'] },
  { label: 'Buiten',            emoji: '🌿', items: ['Bestrating & Terras', 'Tuinafscheiding'] },
]

// ─── Combi metadata (STABU-codes + icons + kleur) ─────────────────────────────

interface CombiMeta {
  stabu: string
  icon: React.ElementType
  bg: string
  iconColor: string
  beschrijving: string
}

const COMBI_META: Record<string, CombiMeta> = {
  'Sloopwerk':            { stabu: '02.10', icon: Hammer,        bg: 'bg-red-500/10 border-red-500/20',       iconColor: 'text-red-400',     beschrijving: 'Sloop, afbraak en puinafvoer' },
  'Fundering & Grondwerk':{ stabu: '08.10', icon: Layers,        bg: 'bg-amber-500/10 border-amber-500/20',   iconColor: 'text-amber-400',   beschrijving: 'Ontgraving, fundering en drainage' },
  'Metselwerk':           { stabu: '21.10', icon: Box,           bg: 'bg-orange-500/10 border-orange-500/20', iconColor: 'text-orange-400',  beschrijving: 'Binnen- en gevelmuur metselwerk' },
  'Betonwerk':            { stabu: '11.10', icon: Box,           bg: 'bg-stone-500/10 border-stone-500/20',   iconColor: 'text-stone-300',   beschrijving: 'Gestort beton, wanden en vloeren' },
  'Riolering':            { stabu: '52.10', icon: Droplet,       bg: 'bg-blue-500/10 border-blue-500/20',     iconColor: 'text-blue-400',    beschrijving: 'PVC-leidingen en rioolaansluiting' },
  'Asbestsanering':       { stabu: '02.50', icon: AlertTriangle, bg: 'bg-yellow-500/10 border-yellow-500/20', iconColor: 'text-yellow-400',  beschrijving: 'Gecertificeerde asbestverwijdering' },
  'Dakwerk':              { stabu: '33.10', icon: Home,          bg: 'bg-sky-500/10 border-sky-500/20',       iconColor: 'text-sky-400',     beschrijving: 'Pannendak, platdak en goten' },
  'Dakkapel & Dakraam':   { stabu: '33.50', icon: Sun,           bg: 'bg-cyan-500/10 border-cyan-500/20',     iconColor: 'text-cyan-400',    beschrijving: 'Dakkapellen en Velux dakramen' },
  'Isolatie':             { stabu: '09.10', icon: Thermometer,   bg: 'bg-teal-500/10 border-teal-500/20',     iconColor: 'text-teal-400',    beschrijving: 'Dak, vloer, spouw en gevelisolatie' },
  'Gevelrenovatie':       { stabu: '37.10', icon: Paintbrush,    bg: 'bg-teal-600/10 border-teal-600/20',     iconColor: 'text-teal-300',    beschrijving: 'Reinigen, voegen en bekleding' },
  'Kozijnen & Deuren':    { stabu: '31.10', icon: Box,           bg: 'bg-cyan-600/10 border-cyan-600/20',     iconColor: 'text-cyan-300',    beschrijving: 'Kozijnen, deuren en schuifpuien' },
  'Stucwerk & Plafonds':  { stabu: '94.10', icon: Layers,        bg: 'bg-purple-500/10 border-purple-500/20', iconColor: 'text-purple-400',  beschrijving: 'Glad stuc, dekvloer en gipskarton' },
  'Tegelwerk':            { stabu: '93.10', icon: Box,           bg: 'bg-violet-500/10 border-violet-500/20', iconColor: 'text-violet-400',  beschrijving: 'Wand- en vloertegels leggen' },
  'Vloerwerk':            { stabu: '91.10', icon: Layers,        bg: 'bg-fuchsia-500/10 border-fuchsia-500/20',iconColor: 'text-fuchsia-400', beschrijving: 'Laminaat, PVC, parket en gietvloer' },
  'Schilderwerk':         { stabu: '97.10', icon: Paintbrush,    bg: 'bg-pink-500/10 border-pink-500/20',     iconColor: 'text-pink-400',    beschrijving: 'Wanden, plafonds en kozijnen schilderen' },
  'Timmerwerk':           { stabu: '31.50', icon: Wrench,        bg: 'bg-rose-500/10 border-rose-500/20',     iconColor: 'text-rose-400',    beschrijving: 'Plinten, panelen en maatwerk hout' },
  'Elektra':              { stabu: '65.10', icon: Zap,           bg: 'bg-indigo-500/10 border-indigo-500/20', iconColor: 'text-indigo-400',  beschrijving: 'Groepen, armaturen en meterkast' },
  'Loodgieterij':         { stabu: '52.50', icon: Droplet,       bg: 'bg-blue-600/10 border-blue-600/20',     iconColor: 'text-blue-300',    beschrijving: 'Water- en afvoerleidingen, sanitair' },
  'CV-installatie':       { stabu: '55.10', icon: Flame,         bg: 'bg-orange-600/10 border-orange-600/20', iconColor: 'text-orange-300',  beschrijving: 'CV-ketel, warmtepomp en radiatoren' },
  'Ventilatie & WTW':     { stabu: '56.10', icon: Wind,          bg: 'bg-sky-600/10 border-sky-600/20',       iconColor: 'text-sky-300',     beschrijving: 'WTW-units, kanalen en roosters' },
  'Zonnepanelen':         { stabu: '67.10', icon: Sun,           bg: 'bg-yellow-600/10 border-yellow-600/20', iconColor: 'text-yellow-300',  beschrijving: 'Panelen, omvormers en batterij' },
  'Badkamer compleet':    { stabu: '90.01', icon: Droplet,       bg: 'bg-emerald-500/10 border-emerald-500/20',iconColor: 'text-emerald-400', beschrijving: 'Volledig badkamerpakket turnkey' },
  'Keukenplaatsing':      { stabu: '90.02', icon: Wrench,        bg: 'bg-green-500/10 border-green-500/20',   iconColor: 'text-green-400',   beschrijving: 'Demontage en plaatsing keuken' },
  'Trap & Balustrade':    { stabu: '94.50', icon: ChevronUp,     bg: 'bg-lime-500/10 border-lime-500/20',     iconColor: 'text-lime-400',    beschrijving: 'Houten trap, leuning en balustrade' },
  'Bestrating & Terras':  { stabu: '80.10', icon: Layers,        bg: 'bg-green-600/10 border-green-600/20',   iconColor: 'text-green-300',   beschrijving: 'Tegels, klinkers en houten vlonder' },
  'Tuinafscheiding':      { stabu: '82.10', icon: Layers,        bg: 'bg-emerald-600/10 border-emerald-600/20',iconColor: 'text-emerald-300', beschrijving: 'Schuttingen, hekken en poorten' },
}

// ─── Combi-foto's ─────────────────────────────────────────────────────────────
// Bestandsnaam per combi. Plaats royalty-vrije foto's in /public/combis/.
// Ontbreekt een bestand, dan valt de kaart automatisch terug op het gekleurde icoon.

const COMBI_FOTO: Record<string, string> = {
  'Sloopwerk':             'sloopwerk.jpg',
  'Fundering & Grondwerk': 'fundering.jpg',
  'Metselwerk':            'metselwerk.jpg',
  'Betonwerk':             'betonwerk.jpg',
  'Riolering':             'riolering.jpg',
  'Asbestsanering':        'asbestsanering.jpg',
  'Dakwerk':               'dakwerk.jpg',
  'Dakkapel & Dakraam':    'dakkapel.jpg',
  'Isolatie':              'isolatie.jpg',
  'Gevelrenovatie':        'gevelrenovatie.jpg',
  'Kozijnen & Deuren':     'kozijnen.jpg',
  'Stucwerk & Plafonds':   'stucwerk.jpg',
  'Tegelwerk':             'tegelwerk.jpg',
  'Vloerwerk':             'vloerwerk.jpg',
  'Schilderwerk':          'schilderwerk.jpg',
  'Timmerwerk':            'timmerwerk.jpg',
  'Elektra':               'elektra.jpg',
  'Loodgieterij':          'loodgieterij.jpg',
  'CV-installatie':        'cv-installatie.jpg',
  'Ventilatie & WTW':      'ventilatie.jpg',
  'Zonnepanelen':          'zonnepanelen.jpg',
  'Badkamer compleet':     'badkamer.jpg',
  'Keukenplaatsing':       'keuken.jpg',
  'Trap & Balustrade':     'trap.jpg',
  'Bestrating & Terras':   'bestrating.jpg',
  'Tuinafscheiding':       'tuinafscheiding.jpg',
}

const EENHEDEN = ['m²', 'm³', 'm¹', 'st', 'uur', 'dag', 'ls', 'kg', 'ton', 'set']

// ─── Helpers ──────────────────────────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2, 9)

// Slug voor elementfoto-bestandsnamen (bv. 'Kunststof raamkozijn HR++ glas' → 'kunststof-raamkozijn-hr-glas')
function slug(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[²³¹]/g, '')
    .replace(/ø/g, 'o').replace(/×/g, 'x')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function legeOnderdeel(soort: Soort = 'materiaal'): Onderdeel {
  return { id: genId(), soort, omschrijving: '', norm: '1', eenheid: 'st', prijs: '' }
}

function legePost(): Post {
  return { id: genId(), omschrijving: '', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '', opbouw: [], open: false }
}

function parseNum(v: string): number {
  return parseFloat(v.replace(',', '.')) || 0
}

function onderdeelKostprijs(o: Onderdeel): number {
  return parseNum(o.norm) * parseNum(o.prijs)
}

function opbouwKostprijs(p: Post): number {
  return p.opbouw.reduce((s, o) => s + onderdeelKostprijs(o), 0)
}

// Kostprijs per eenheid: uit receptuur indien aanwezig, anders directe prijs
function postEenheidsprijs(p: Post): number {
  return p.opbouw.length ? opbouwKostprijs(p) : parseNum(p.eenheidsprijs)
}

function postTotaal(p: Post): number {
  return parseNum(p.hoeveelheid) * postEenheidsprijs(p)
}

function hoofdstukTotaal(h: Hoofdstuk): number {
  return h.posten.reduce((s, p) => s + postTotaal(p), 0)
}

type Mamo = { materiaal: number; arbeid: number; materieel: number; onderaanneming: number }

function postMamo(p: Post): Mamo {
  const qty = parseNum(p.hoeveelheid)
  const out: Mamo = { materiaal: 0, arbeid: 0, materieel: 0, onderaanneming: 0 }
  if (p.opbouw.length) {
    for (const o of p.opbouw) out[o.soort] += qty * onderdeelKostprijs(o)
  } else {
    // Vrije regel zonder opbouw → naar onderaanneming-bucket
    out.onderaanneming += qty * parseNum(p.eenheidsprijs)
  }
  return out
}

function begrotingMamo(hoofdstukken: Hoofdstuk[]): Mamo {
  const out: Mamo = { materiaal: 0, arbeid: 0, materieel: 0, onderaanneming: 0 }
  for (const h of hoofdstukken) for (const p of h.posten) {
    const m = postMamo(p)
    out.materiaal += m.materiaal
    out.arbeid += m.arbeid
    out.materieel += m.materieel
    out.onderaanneming += m.onderaanneming
  }
  return out
}

function postUren(p: Post): number {
  if (!p.opbouw.length) return 0
  const qty = parseNum(p.hoeveelheid)
  return p.opbouw.filter(o => o.soort === 'arbeid').reduce((s, o) => s + qty * parseNum(o.norm), 0)
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

// ─── CUF export ───────────────────────────────────────────────────────────────

function exporteerAlsCUF(
  projectNaam: string,
  projectNummer: string,
  klant: string,
  datum: string,
  hoofdstukken: Hoofdstuk[],
  opslag: string,
  btwPct: string,
): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const subtotaal = hoofdstukken.reduce((s, h) => s + hoofdstukTotaal(h), 0)
  const opslagBedrag = subtotaal * (parseNum(opslag) / 100)
  const exclBtw = subtotaal + opslagBedrag
  const btwBedrag = exclBtw * (parseNum(btwPct) / 100)
  const totaal = exclBtw + btwBedrag
  const nu = new Date().toISOString().replace('Z', '').slice(0, 19)
  const bm = begrotingMamo(hoofdstukken)
  const totUren = hoofdstukken.reduce((s, h) => s + h.posten.reduce((t, p) => t + postUren(p), 0), 0)

  const bundelingen = hoofdstukken.map((h, hIdx) => {
    const hUren = h.posten.reduce((t, p) => t + postUren(p), 0)
    const hm = h.posten.reduce<Mamo>((acc, p) => {
      const m = postMamo(p)
      acc.materiaal += m.materiaal; acc.arbeid += m.arbeid; acc.materieel += m.materieel; acc.onderaanneming += m.onderaanneming
      return acc
    }, { materiaal: 0, arbeid: 0, materieel: 0, onderaanneming: 0 })

    const regels = h.posten
      .filter(p => p.omschrijving)
      .map((p, pIdx) => {
        const ep = postEenheidsprijs(p)
        const recept = p.opbouw
          .map(o =>
            `        <RECEPTREGEL SOORT="${o.soort}" OMSCHRIJVING="${esc(o.omschrijving)}" NORM="${parseNum(o.norm)}" EENHEID="${esc(o.eenheid)}" PRIJS="${parseNum(o.prijs)}" />`
          ).join('\n')
        const open = `      <BEGROTINGSREGEL CODE="${hIdx + 1}.${pIdx + 1}" OMSCHRIJVING="${esc(p.omschrijving)}" HOEVEELHEID_EENHEID="${esc(p.eenheid)}" HOEVEELHEID="${parseNum(p.hoeveelheid)}" INZET="1" HOEVEELHEID_FACTOR="1" KOSTPRIJS="${ep.toFixed(5)}" BTW=""`
        return recept ? `${open}>\n${recept}\n      </BEGROTINGSREGEL>` : `${open} />`
      }).join('\n')

    return `    <BUNDELING CODE="${hIdx + 1}" OMSCHRIJVING="${esc(h.naam)}" EENHEID="PST" TERUGDEEL_HOEVEELHEID="1" UREN="${hUren.toFixed(2)}" LOONKOSTEN="${hm.arbeid.toFixed(5)}" MATERIAALKOSTEN="${hm.materiaal.toFixed(5)}" MATERIEELKOSTEN="${hm.materieel.toFixed(5)}" ONDERAANNEMING="${hm.onderaanneming.toFixed(5)}">
${regels}
    </BUNDELING>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<CUF xmlns="x-schema:CufSchema.xml" AANMAAKDATUMTIJD="${nu}">
  <PROJECTGEGEVENS CUF_VERSIE="4.003" SYSTEEMHUIS="Orlando" AANMAAKDATUM="${datum}" PROJECTNUMMER="${esc(projectNummer)}" PROJECTNAAM="${esc(projectNaam)}" CALCULATOR="Orlando Core OS" OPDRACHTGEVER="${esc(klant)}" VALUTA="EUR" EURO_KOERS="1" OPSLAG_PCT="${opslag}" BTW_PCT="${btwPct}" />
  <BEGROTING UREN="${totUren.toFixed(2)}" LOONKOSTEN="${bm.arbeid.toFixed(5)}" MATERIAALKOSTEN="${bm.materiaal.toFixed(5)}" MATERIEELKOSTEN="${bm.materieel.toFixed(5)}" ONDERAANNEMING="${bm.onderaanneming.toFixed(5)}" OVERIGE_KOSTEN="0">
${bundelingen}
  </BEGROTING>
  <STAARTGEGEVENS AANNEEMSOM="${totaal.toFixed(5)}">
    <VRIJE_GROOTHEID OMSCHRIJVING="Subtotaal excl. opslag" BEDRAG="${subtotaal.toFixed(2)}" />
    <VRIJE_GROOTHEID OMSCHRIJVING="Opslag (${opslag}%)" BEDRAG="${opslagBedrag.toFixed(2)}" />
    <VRIJE_GROOTHEID OMSCHRIJVING="Subtotaal excl. BTW" BEDRAG="${exclBtw.toFixed(2)}" />
    <VRIJE_GROOTHEID OMSCHRIJVING="BTW (${btwPct}%)" BEDRAG="${btwBedrag.toFixed(2)}" />
  </STAARTGEGEVENS>
</CUF>`
}

// ─── CUF import ───────────────────────────────────────────────────────────────

interface CUFData {
  projectNaam: string
  projectNummer: string
  klant: string
  opslag: string
  btwPct: string
  hoofdstukken: Hoofdstuk[]
}

function parseerdCUF(xmlText: string): CUFData | null {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, 'text/xml')
    if (doc.querySelector('parsererror')) return null

    const pg = doc.querySelector('PROJECTGEGEVENS')
    const projectNaam = pg?.getAttribute('PROJECTNAAM') ?? 'Geïmporteerde calculatie'
    const projectNummer = pg?.getAttribute('PROJECTNUMMER') ?? ''
    const klant = pg?.getAttribute('OPDRACHTGEVER') ?? ''
    const opslag = pg?.getAttribute('OPSLAG_PCT') ?? '10'
    const btwPct = pg?.getAttribute('BTW_PCT') ?? '21'

    const geldigeSoort = (s: string | null): Soort =>
      (['materiaal', 'arbeid', 'materieel', 'onderaanneming'].includes(s ?? '') ? s : 'materiaal') as Soort

    const bundelingen = Array.from(doc.querySelectorAll('BEGROTING > BUNDELING'))
    const hoofdstukken: Hoofdstuk[] = bundelingen.map(b => {
      const naam = b.getAttribute('OMSCHRIJVING') ?? 'Hoofdstuk'
      const posten: Post[] = Array.from(b.querySelectorAll(':scope > BEGROTINGSREGEL'))
        .map(r => {
          const opbouw: Onderdeel[] = Array.from(r.querySelectorAll(':scope > RECEPTREGEL')).map(rr => ({
            id: genId(),
            soort: geldigeSoort(rr.getAttribute('SOORT')),
            omschrijving: rr.getAttribute('OMSCHRIJVING') ?? '',
            norm: rr.getAttribute('NORM') ?? '1',
            eenheid: rr.getAttribute('EENHEID') ?? 'st',
            prijs: rr.getAttribute('PRIJS') ?? '',
          }))
          return {
            id: genId(),
            omschrijving: r.getAttribute('OMSCHRIJVING') ?? '',
            hoeveelheid: r.getAttribute('HOEVEELHEID') ?? '',
            eenheid: r.getAttribute('HOEVEELHEID_EENHEID') ?? 'm²',
            eenheidsprijs: opbouw.length ? '' : (
              r.getAttribute('KOSTPRIJS') ||
              r.getAttribute('MATERIAALPRIJS') ||
              r.getAttribute('ONDERAANNEMINGSPRIJS') ||
              r.getAttribute('UUR_TARIEF') ||
              ''
            ),
            opbouw,
            open: false,
          }
        })
        .filter(p => p.omschrijving)
      return { id: genId(), naam, posten: posten.length ? posten : [legePost()], open: true }
    })

    return {
      projectNaam, projectNummer, klant, opslag, btwPct,
      hoofdstukken: hoofdstukken.length
        ? hoofdstukken
        : [{ id: genId(), naam: 'Hoofdstuk 1', posten: [legePost()], open: true }],
    }
  } catch {
    return null
  }
}

// ─── InlineInput ─────────────────────────────────────────────────────────────

function InlineInput({
  value, onChange, placeholder, className, align = 'left',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  align?: 'left' | 'right'
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={clsx(
        'bg-transparent focus:outline-none focus:bg-white/5 rounded px-1 -mx-1 w-full text-xs text-white placeholder:text-white/20 transition-colors',
        align === 'right' && 'text-right',
        className,
      )}
    />
  )
}

// ─── CombiFoto (foto met fallback naar icoon) ─────────────────────────────────

function CombiFoto({
  naam,
  className,
  iconSize = 28,
}: {
  naam: string
  className?: string
  iconSize?: number
}) {
  const [fout, setFout] = useState(false)
  const meta = COMBI_META[naam]
  const Icon = meta?.icon ?? Box
  const bestand = COMBI_FOTO[naam]

  if (bestand && !fout) {
    return (
      <div className={clsx('relative overflow-hidden bg-zinc-900', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/combis/${bestand}`}
          alt={naam}
          loading="lazy"
          onError={() => setFout(true)}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      </div>
    )
  }

  return (
    <div className={clsx('flex items-center justify-center', meta?.bg ?? 'bg-white/5', className)}>
      <Icon size={iconSize} className={clsx('opacity-80', meta?.iconColor ?? 'text-white/40')} />
    </div>
  )
}

// ─── ElementFoto (foto per regel/element in de tussenlaag) ────────────────────
// Probeert /public/combis/elementen/<slug>.jpg, valt terug op het combi-icoon.

function ElementFoto({
  combiNaam,
  omschrijving,
  className,
  iconSize = 16,
}: {
  combiNaam?: string
  omschrijving: string
  className?: string
  iconSize?: number
}) {
  const [fout, setFout] = useState(false)
  const meta = combiNaam ? COMBI_META[combiNaam] : undefined
  const Icon = meta?.icon ?? Box
  const naam = slug(omschrijving)

  useEffect(() => { setFout(false) }, [naam])

  if (naam && !fout) {
    return (
      <div className={clsx('relative overflow-hidden bg-zinc-900', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/combis/elementen/${naam}.jpg`}
          alt={omschrijving}
          loading="lazy"
          onError={() => setFout(true)}
          className="w-full h-full object-cover"
        />
      </div>
    )
  }

  return (
    <div className={clsx('flex items-center justify-center', meta?.bg ?? 'bg-white/[0.06]', className)}>
      <Icon size={iconSize} className={clsx('opacity-70', meta?.iconColor ?? 'text-white/35')} />
    </div>
  )
}

// ─── CombiCatalogusModal ──────────────────────────────────────────────────────

function CombiCatalogusModal({
  isOpen,
  onClose,
  onInsert,
}: {
  isOpen: boolean
  onClose: () => void
  onInsert: (naam: string) => void
}) {
  const [activeCat, setActiveCat] = useState(COMBI_GROEPEN[0].label)
  const [activeCombi, setActiveCombi] = useState<string | null>(null)
  const [zoek, setZoek] = useState('')

  useEffect(() => {
    if (isOpen) { setZoek(''); setActiveCombi(null); setActiveCat(COMBI_GROEPEN[0].label) }
  }, [isOpen])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    if (isOpen) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const zoekResultaten = useMemo(() => {
    const q = zoek.trim().toLowerCase()
    if (!q) return null
    const results: string[] = []
    for (const groep of COMBI_GROEPEN) {
      for (const naam of groep.items) {
        if (
          naam.toLowerCase().includes(q) ||
          (COMBI_META[naam]?.beschrijving ?? '').toLowerCase().includes(q) ||
          (COMBI_META[naam]?.stabu ?? '').includes(q)
        ) {
          results.push(naam)
        }
      }
    }
    return results
  }, [zoek])

  const huidigGroep = COMBI_GROEPEN.find(g => g.label === activeCat)
  const toonItems: string[] = zoekResultaten ?? (huidigGroep?.items ?? [])

  const aantalMetOpbouw = (naam: string) => COMBIS[naam]?.filter(r => r.opbouw && r.opbouw.length).length ?? 0

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-zinc-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ height: 'min(85vh, 700px)' }}>

        {/* Header — search */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-white/[0.08] shrink-0">
          <Search size={15} className="text-white/25 shrink-0" />
          <input
            autoFocus
            value={zoek}
            onChange={e => { setZoek(e.target.value); setActiveCombi(null) }}
            placeholder="Zoek combi... bijv. metselwerk, elektra, vloerverwarming"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none"
          />
          {zoek && (
            <button onClick={() => setZoek('')} className="text-white/30 hover:text-white/70 transition-colors">
              <X size={13} />
            </button>
          )}
          <div className="w-px h-4 bg-white/10 mx-1" />
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left — category sidebar */}
          {!zoek && (
            <div className="w-44 shrink-0 border-r border-white/[0.06] overflow-y-auto py-2 bg-white/[0.01]">
              {COMBI_GROEPEN.map(g => (
                <button
                  key={g.label}
                  onClick={() => { setActiveCat(g.label); setActiveCombi(null) }}
                  className={clsx(
                    'w-full text-left px-4 py-2.5 text-[11px] font-medium transition-colors flex items-center gap-2.5',
                    activeCat === g.label
                      ? 'bg-indigo-600/15 text-indigo-300 border-r-2 border-indigo-500'
                      : 'text-white/45 hover:text-white/80 hover:bg-white/[0.04]',
                  )}
                >
                  <span className="text-sm">{g.emoji}</span>
                  <span>{g.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Right — content */}
          <div className="flex-1 overflow-y-auto p-5">

            {activeCombi ? (
              <div>
                {/* Foto-banner */}
                <div className="relative h-32 rounded-xl overflow-hidden mb-4">
                  <CombiFoto naam={activeCombi} className="absolute inset-0" iconSize={48} />
                  <button
                    onClick={() => setActiveCombi(null)}
                    className="absolute top-2.5 left-2.5 flex items-center gap-1 text-[10px] text-white bg-black/45 backdrop-blur-sm px-2 py-1 rounded-lg hover:bg-black/65 transition-colors"
                  >
                    <ChevronLeft size={12} />
                    Terug
                  </button>
                  <span className="absolute top-2.5 right-2.5 text-[9px] font-mono text-white/85 bg-black/45 backdrop-blur-sm px-1.5 py-0.5 rounded">
                    STABU {COMBI_META[activeCombi]?.stabu}
                  </span>
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-base font-bold text-white drop-shadow">{activeCombi}</p>
                    <p className="text-[10px] text-white/80 drop-shadow">
                      {COMBIS[activeCombi]?.length} regels · {COMBI_META[activeCombi]?.beschrijving}
                    </p>
                  </div>
                </div>

                {/* Line items preview */}
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden mb-4">
                  <div
                    className="grid text-[9px] text-white/25 uppercase tracking-widest px-3 py-2 border-b border-white/[0.05]"
                    style={{ gridTemplateColumns: '36px 1fr 56px 48px 84px' }}
                  >
                    <span />
                    <span>Element / regel</span>
                    <span className="text-right">Hoev.</span>
                    <span className="pl-1.5">Eenh.</span>
                    <span className="text-right">Kostprijs</span>
                  </div>
                  {COMBIS[activeCombi]?.map((r, i) => {
                    const ep = r.opbouw && r.opbouw.length
                      ? r.opbouw.reduce((s, o) => s + parseNum(o.norm) * parseNum(o.prijs), 0)
                      : parseNum(r.eenheidsprijs)
                    return (
                      <div
                        key={i}
                        className="grid items-center gap-2 px-3 py-1.5 border-b border-white/[0.03] last:border-0"
                        style={{ gridTemplateColumns: '36px 1fr 56px 48px 84px' }}
                      >
                        <ElementFoto combiNaam={activeCombi} omschrijving={r.omschrijving} className="w-8 h-8 rounded-md" iconSize={15} />
                        <span className="text-xs text-white/65 truncate pr-2 flex items-center gap-1.5">
                          {r.omschrijving}
                          {r.opbouw && r.opbouw.length > 0 && (
                            <span className="text-[8px] font-medium text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 px-1 py-0.5 rounded leading-none shrink-0">
                              {r.opbouw.length}-delig
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-right text-white/30 tabular-nums">{r.hoeveelheid || '—'}</span>
                        <span className="text-xs text-white/35 pl-1.5">{r.eenheid}</span>
                        <span className="text-xs text-right text-white/55 tabular-nums">€ {ep.toFixed(2)}</span>
                      </div>
                    )
                  })}
                </div>

                {aantalMetOpbouw(activeCombi) > 0 && (
                  <p className="text-[10px] text-white/40 mb-3 flex items-center gap-1.5">
                    <Sigma size={11} className="text-indigo-400" />
                    {aantalMetOpbouw(activeCombi)} regels zijn samengestelde elementen — klap ze na invoegen open voor de opbouw (materiaal · arbeid · materieel).
                  </p>
                )}

                <button
                  onClick={() => { onInsert(activeCombi); onClose() }}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white text-sm font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={14} />
                  Combi invoegen in hoofdstuk
                </button>
              </div>

            ) : (
              <div>
                <p className="text-[10px] text-white/25 uppercase tracking-wider mb-4">
                  {zoek
                    ? `${toonItems.length} resultaten voor "${zoek}"`
                    : `${huidigGroep?.emoji} ${activeCat} — ${toonItems.length} combis`}
                </p>

                {toonItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2">
                    <Search size={24} className="text-white/15" />
                    <p className="text-sm text-white/30">Geen combis gevonden</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    {toonItems.map(naam => {
                      const meta = COMBI_META[naam]
                      const metOpbouw = aantalMetOpbouw(naam)
                      return (
                        <button
                          key={naam}
                          onClick={() => setActiveCombi(naam)}
                          className="text-left rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden transition-all duration-150 hover:scale-[1.02] active:scale-[0.98] hover:border-white/20 hover:bg-white/[0.06]"
                        >
                          <div className="relative h-24">
                            <CombiFoto naam={naam} className="absolute inset-0" iconSize={30} />
                            <span className="absolute top-2 right-2 text-[9px] font-mono text-white/80 bg-black/45 backdrop-blur-sm px-1.5 py-0.5 rounded">
                              {meta?.stabu}
                            </span>
                            {metOpbouw > 0 && (
                              <span className="absolute top-2 left-2 flex items-center gap-0.5 text-[8px] font-medium text-indigo-200 bg-indigo-600/70 backdrop-blur-sm px-1.5 py-0.5 rounded">
                                <Sigma size={8} /> opbouw
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-[11px] font-semibold text-white leading-tight mb-1">{naam}</p>
                            <p className="text-[10px] text-white/35 leading-relaxed line-clamp-2">{meta?.beschrijving}</p>
                            <p className="text-[9px] text-white/20 mt-2">{COMBIS[naam]?.length} regels</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Opbouw-editor (de tussenlaag) ────────────────────────────────────────────

function OpbouwEditor({
  post,
  onAdd,
  onUpdate,
  onRemove,
}: {
  post: Post
  onAdd: (soort: Soort) => void
  onUpdate: (oId: string, patch: Partial<Onderdeel>) => void
  onRemove: (oId: string) => void
}) {
  const kostprijs = opbouwKostprijs(post)

  return (
    <div className="bg-black/25 border-t border-white/[0.05] px-4 py-3 print:bg-transparent">
      <div className="flex items-center gap-2 mb-2">
        <ElementFoto omschrijving={post.omschrijving} className="w-9 h-9 rounded-md shrink-0 print:hidden" iconSize={16} />
        <div className="min-w-0">
          <p className="text-[11px] text-white/60 font-medium leading-tight truncate">{post.omschrijving || 'Element'}</p>
          <p className="text-[9px] text-white/35 uppercase tracking-wider flex items-center gap-1">
            <Sigma size={9} className="text-indigo-400" /> Opbouw — kostprijs per {post.eenheid}
          </p>
        </div>
      </div>

      {post.opbouw.length > 0 ? (
        <div className="rounded-lg border border-white/[0.06] overflow-hidden">
          {/* Column headers */}
          <div
            className="grid items-center gap-2 px-3 py-1.5 text-[8px] text-white/25 uppercase tracking-widest bg-white/[0.02] border-b border-white/[0.04]"
            style={{ gridTemplateColumns: '92px 1fr 60px 56px 84px 84px 20px' }}
          >
            <span>Soort</span>
            <span>Omschrijving</span>
            <span className="text-right">Norm/eenh.</span>
            <span className="pl-1">Eenheid</span>
            <span className="text-right">Tarief</span>
            <span className="text-right">Kostprijs</span>
            <span />
          </div>

          {post.opbouw.map(o => {
            const info = soortInfo(o.soort)
            const sub = onderdeelKostprijs(o)
            return (
              <div
                key={o.id}
                className="grid items-center gap-2 px-3 py-1.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors group/od"
                style={{ gridTemplateColumns: '92px 1fr 60px 56px 84px 84px 20px' }}
              >
                <select
                  value={o.soort}
                  onChange={e => onUpdate(o.id, { soort: e.target.value as Soort })}
                  className={clsx('text-[9px] font-medium rounded border px-1 py-0.5 focus:outline-none cursor-pointer', info.cls)}
                >
                  {SOORTEN.map(s => (
                    <option key={s.key} value={s.key} className="bg-zinc-900 text-white">{s.label}</option>
                  ))}
                </select>
                <InlineInput
                  value={o.omschrijving}
                  onChange={v => onUpdate(o.id, { omschrijving: v })}
                  placeholder="Onderdeel..."
                />
                <InlineInput
                  value={o.norm}
                  onChange={v => onUpdate(o.id, { norm: v })}
                  placeholder="1"
                  align="right"
                />
                <select
                  value={o.eenheid}
                  onChange={e => onUpdate(o.id, { eenheid: e.target.value })}
                  className="bg-transparent text-[11px] text-white/50 focus:outline-none focus:text-white transition-colors pl-1"
                >
                  {EENHEDEN.map(e => (
                    <option key={e} value={e} className="bg-zinc-900 text-white">{e}</option>
                  ))}
                </select>
                <div className="flex items-center gap-0.5 justify-end">
                  <span className="text-[10px] text-white/30">€</span>
                  <InlineInput
                    value={o.prijs}
                    onChange={v => onUpdate(o.id, { prijs: v })}
                    placeholder="0,00"
                    align="right"
                  />
                </div>
                <span className="text-[11px] text-right text-white/60 tabular-nums">{fmtEur(sub)}</span>
                <button
                  onClick={() => onRemove(o.id)}
                  className="text-white/15 hover:text-red-400 opacity-0 group-hover/od:opacity-100 transition-all"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            )
          })}

          {/* Kostprijs-footer */}
          <div
            className="grid items-center gap-2 px-3 py-1.5 bg-indigo-500/[0.06] border-t border-indigo-500/15"
            style={{ gridTemplateColumns: '1fr 84px 20px' }}
          >
            <span className="text-[10px] font-medium text-indigo-300">Kostprijs per {post.eenheid}</span>
            <span className="text-[11px] text-right font-semibold text-indigo-200 tabular-nums">{fmtEur(kostprijs)}</span>
            <span />
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-white/30 italic mb-2">
          Nog geen opbouw. Voeg onderdelen toe (materiaal · arbeid · materieel · onderaanneming) of laat leeg voor een directe eenheidsprijs.
        </p>
      )}

      {/* Add onderdeel buttons */}
      <div className="flex flex-wrap items-center gap-1.5 mt-2 print:hidden">
        {SOORTEN.map(s => (
          <button
            key={s.key}
            onClick={() => onAdd(s.key)}
            className={clsx('flex items-center gap-1 text-[9px] font-medium border px-2 py-1 rounded transition-all hover:brightness-125', s.cls)}
          >
            <Plus size={9} />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalculatorPage() {
  const router = useRouter()

  const [projectNaam, setProjectNaam] = useState('Nieuwe calculatie')
  const [editingNaam, setEditingNaam] = useState(false)
  const [klant, setKlant] = useState('')
  const [datum] = useState(
    new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  )
  const [hoofdstukken, setHoofdstukken] = useState<Hoofdstuk[]>([
    { id: genId(), naam: 'Hoofdstuk 1', open: true, posten: [legePost()] },
  ])
  const [opslag, setOpslag] = useState('10')
  const [btwPct, setBtwPct] = useState('21')
  const [combiModalFor, setCombiModalFor] = useState<string | null>(null)
  const [importFout, setImportFout] = useState<string | null>(null)
  const [projectNummer, setProjectNummer] = useState(
    `CAL-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Totals
  const subtotaal = hoofdstukken.reduce((s, h) => s + hoofdstukTotaal(h), 0)
  const opslagBedrag = subtotaal * (parseNum(opslag) / 100)
  const exclBtw = subtotaal + opslagBedrag
  const btwBedrag = exclBtw * (parseNum(btwPct) / 100)
  const totaalInclBtw = exclBtw + btwBedrag
  const mamo = begrotingMamo(hoofdstukken)
  const mamoTotaal = mamo.materiaal + mamo.arbeid + mamo.materieel + mamo.onderaanneming

  // Hoofdstuk handlers
  const addHoofdstuk = () =>
    setHoofdstukken(prev => [
      ...prev,
      { id: genId(), naam: `Hoofdstuk ${prev.length + 1}`, open: true, posten: [legePost()] },
    ])

  const removeHoofdstuk = (hId: string) =>
    setHoofdstukken(prev => prev.filter(h => h.id !== hId))

  const updateHoofdstuk = (hId: string, patch: Partial<Hoofdstuk>) =>
    setHoofdstukken(prev => prev.map(h => h.id === hId ? { ...h, ...patch } : h))

  const moveHoofdstuk = (hId: string, dir: -1 | 1) =>
    setHoofdstukken(prev => {
      const idx = prev.findIndex(h => h.id === hId)
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })

  // Post handlers
  const addPost = (hId: string) =>
    setHoofdstukken(prev => prev.map(h =>
      h.id === hId ? { ...h, posten: [...h.posten, legePost()] } : h
    ))

  const removePost = (hId: string, pId: string) =>
    setHoofdstukken(prev => prev.map(h =>
      h.id === hId ? { ...h, posten: h.posten.filter(p => p.id !== pId) } : h
    ))

  const updatePost = (hId: string, pId: string, patch: Partial<Post>) =>
    setHoofdstukken(prev => prev.map(h =>
      h.id === hId
        ? { ...h, posten: h.posten.map(p => p.id === pId ? { ...p, ...patch } : p) }
        : h
    ))

  const togglePostOpen = (hId: string, pId: string) =>
    setHoofdstukken(prev => prev.map(h =>
      h.id === hId
        ? { ...h, posten: h.posten.map(p => p.id === pId ? { ...p, open: !p.open } : p) }
        : h
    ))

  // Onderdeel (opbouw) handlers
  const addOnderdeel = (hId: string, pId: string, soort: Soort) =>
    setHoofdstukken(prev => prev.map(h =>
      h.id === hId
        ? {
            ...h,
            posten: h.posten.map(p =>
              p.id === pId ? { ...p, open: true, opbouw: [...p.opbouw, legeOnderdeel(soort)] } : p
            ),
          }
        : h
    ))

  const updateOnderdeel = (hId: string, pId: string, oId: string, patch: Partial<Onderdeel>) =>
    setHoofdstukken(prev => prev.map(h =>
      h.id === hId
        ? {
            ...h,
            posten: h.posten.map(p =>
              p.id === pId
                ? { ...p, opbouw: p.opbouw.map(o => o.id === oId ? { ...o, ...patch } : o) }
                : p
            ),
          }
        : h
    ))

  const removeOnderdeel = (hId: string, pId: string, oId: string) =>
    setHoofdstukken(prev => prev.map(h =>
      h.id === hId
        ? {
            ...h,
            posten: h.posten.map(p =>
              p.id === pId ? { ...p, opbouw: p.opbouw.filter(o => o.id !== oId) } : p
            ),
          }
        : h
    ))

  // CUF export
  const downloadCUF = () => {
    const xml = exporteerAlsCUF(projectNaam, projectNummer, klant, datum, hoofdstukken, opslag, btwPct)
    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectNummer || projectNaam}.xml`
    a.click()
    URL.revokeObjectURL(url)
  }

  // CUF import
  const laadCUFBestand = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const text = evt.target?.result as string
      const data = parseerdCUF(text)
      if (!data) {
        setImportFout('Ongeldig CUF-bestand. Controleer het bestand en probeer opnieuw.')
        return
      }
      setProjectNaam(data.projectNaam)
      setProjectNummer(data.projectNummer)
      setKlant(data.klant)
      setOpslag(data.opslag)
      setBtwPct(data.btwPct)
      setHoofdstukken(data.hoofdstukken)
      setImportFout(null)
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  // Combi insert
  const insertCombi = (naam: string) => {
    if (!combiModalFor) return
    const posten: Post[] = COMBIS[naam].map(r => ({
      id: genId(),
      omschrijving: r.omschrijving,
      hoeveelheid: r.hoeveelheid,
      eenheid: r.eenheid,
      eenheidsprijs: r.eenheidsprijs,
      opbouw: (r.opbouw ?? []).map(o => ({ id: genId(), ...o })),
      open: false,
    }))
    updateHoofdstuk(combiModalFor, { naam, posten })
  }

  // Duplicate chapter
  const duplicateHoofdstuk = (h: Hoofdstuk) =>
    setHoofdstukken(prev => {
      const idx = prev.findIndex(x => x.id === h.id)
      const copy: Hoofdstuk = {
        ...h,
        id: genId(),
        naam: `${h.naam} (kopie)`,
        posten: h.posten.map(p => ({ ...p, id: genId(), opbouw: p.opbouw.map(o => ({ ...o, id: genId() })) })),
      }
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })

  return (
    <div className="space-y-4 pb-12 print:pb-0">

      <CombiCatalogusModal
        isOpen={combiModalFor !== null}
        onClose={() => setCombiModalFor(null)}
        onInsert={insertCombi}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/calculaties')}
            className="text-white/40 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Calculator size={16} className="text-orange-400" />
          </div>
          <div>
            {editingNaam ? (
              <div className="flex items-center gap-1">
                <input
                  autoFocus
                  value={projectNaam}
                  onChange={e => setProjectNaam(e.target.value)}
                  onBlur={() => setEditingNaam(false)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingNaam(false) }}
                  className="bg-white/10 border border-white/20 text-white text-sm font-semibold px-2 py-0.5 rounded focus:outline-none"
                />
                <button onClick={() => setEditingNaam(false)} className="text-green-400">
                  <Check size={13} />
                </button>
              </div>
            ) : (
              <button onClick={() => setEditingNaam(true)} className="flex items-center gap-1.5 group">
                <h1 className="text-base font-semibold text-white group-hover:text-white/80 transition-colors">
                  {projectNaam}
                </h1>
                <Pencil size={11} className="text-white/20 group-hover:text-white/50 transition-colors" />
              </button>
            )}
            <p className="text-xs text-white/40">{projectNummer} · {datum}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={12} />
            CUF inladen
          </button>
          <button
            onClick={downloadCUF}
            className="flex items-center gap-2 border border-indigo-500/30 text-indigo-400 hover:text-indigo-300 hover:border-indigo-400/50 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Download size={12} />
            Exporteren als CUF
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Printer size={12} />
            Afdrukken
          </button>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept=".xml,.cuf" onChange={laadCUFBestand} className="hidden" />

      {importFout && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-red-400">{importFout}</p>
          <button onClick={() => setImportFout(null)} className="text-red-400/60 hover:text-red-400 ml-4">
            <X size={12} />
          </button>
        </div>
      )}

      {/* Print header */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-black">{projectNaam}</h1>
        <p className="text-sm text-gray-500">{projectNummer} · {datum}{klant ? ` · ${klant}` : ''}</p>
      </div>

      {/* Meta row */}
      <div className="grid grid-cols-2 gap-3 print:hidden">
        <div className="bg-white/[0.04] border border-white/5 rounded-lg px-3 py-2">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Projectnummer</p>
          <InlineInput value={projectNummer} onChange={setProjectNummer} placeholder="CAL-2025-001" />
        </div>
        <div className="bg-white/[0.04] border border-white/5 rounded-lg px-3 py-2">
          <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Klant / opdrachtgever</p>
          <InlineInput value={klant} onChange={setKlant} placeholder="Naam opdrachtgever..." />
        </div>
      </div>

      {/* Chapters */}
      <div className="space-y-3">
        {hoofdstukken.map((h, hIdx) => {
          const htotaal = hoofdstukTotaal(h)
          return (
            <div
              key={h.id}
              className="bg-white/[0.06] border border-white/5 rounded-xl overflow-hidden print:border print:border-gray-200 print:rounded-none print:mb-4"
            >
              {/* Chapter header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 print:border-b print:border-gray-200 group/hdr">
                <button
                  onClick={() => updateHoofdstuk(h.id, { open: !h.open })}
                  className="text-white/40 hover:text-white transition-colors print:hidden"
                >
                  {h.open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <span className="text-[11px] text-white/30 font-mono w-6 print:text-black">{hIdx + 1}.</span>
                <InlineInput
                  value={h.naam}
                  onChange={v => updateHoofdstuk(h.id, { naam: v })}
                  className="font-semibold text-sm print:text-black"
                />
                {htotaal > 0 && (
                  <span className="text-xs font-semibold text-white/70 ml-auto whitespace-nowrap print:text-black">
                    {fmtEur(htotaal)}
                  </span>
                )}

                <button
                  onClick={() => setCombiModalFor(h.id)}
                  className="text-[10px] border px-2 py-1 rounded transition-all text-indigo-400/60 border-indigo-500/20 opacity-0 group-hover/hdr:opacity-100 hover:text-indigo-300 hover:border-indigo-500/50 hover:bg-indigo-500/5 print:hidden shrink-0"
                >
                  Combi invoegen
                </button>

                <div className="flex items-center gap-0.5 opacity-0 group-hover/hdr:opacity-100 transition-opacity print:hidden">
                  <button onClick={() => moveHoofdstuk(h.id, -1)} className="p-1 text-white/20 hover:text-white/60 transition-colors" title="Omhoog">
                    <ChevronUp size={12} />
                  </button>
                  <button onClick={() => moveHoofdstuk(h.id, 1)} className="p-1 text-white/20 hover:text-white/60 transition-colors" title="Omlaag">
                    <ChevronDown size={12} />
                  </button>
                  <button onClick={() => duplicateHoofdstuk(h)} className="p-1 text-white/20 hover:text-white/60 transition-colors" title="Dupliceren">
                    <Copy size={12} />
                  </button>
                  <button onClick={() => removeHoofdstuk(h.id)} className="p-1 text-white/20 hover:text-red-400 transition-colors" title="Verwijderen">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Posts */}
              {h.open && (
                <>
                  {/* Column headers */}
                  <div
                    className="grid items-center gap-2 px-4 py-2 text-[9px] text-white/25 uppercase tracking-widest border-b border-white/[0.03] print:text-gray-400 print:border-gray-100"
                    style={{ gridTemplateColumns: '20px 1fr 72px 68px 110px 90px 24px' }}
                  >
                    <span />
                    <span>Omschrijving</span>
                    <span className="text-right">Hoeveelheid</span>
                    <span className="pl-1">Eenheid</span>
                    <span className="text-right">Kostprijs / eenheid</span>
                    <span className="text-right">Totaal</span>
                    <span />
                  </div>

                  {h.posten.map((p, pIdx) => {
                    const pt = postTotaal(p)
                    const heeftOpbouw = p.opbouw.length > 0
                    const ep = postEenheidsprijs(p)
                    return (
                      <div key={p.id} className="border-b border-white/[0.03] print:border-gray-50">
                        {/* Element row */}
                        <div
                          className="grid items-center gap-2 px-4 py-1.5 hover:bg-white/[0.02] transition-colors group/post"
                          style={{ gridTemplateColumns: '20px 1fr 72px 68px 110px 90px 24px' }}
                        >
                          {/* Expand toggle */}
                          <button
                            onClick={() => togglePostOpen(h.id, p.id)}
                            className={clsx(
                              'flex items-center justify-center transition-colors print:hidden',
                              p.open ? 'text-indigo-400' : 'text-white/25 hover:text-white/60',
                            )}
                            title={p.open ? 'Opbouw inklappen' : 'Opbouw tonen / toevoegen'}
                          >
                            {p.open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </button>

                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[9px] text-white/20 font-mono w-7 shrink-0 print:text-gray-400">
                              {hIdx + 1}.{pIdx + 1}
                            </span>
                            <InlineInput
                              value={p.omschrijving}
                              onChange={v => updatePost(h.id, p.id, { omschrijving: v })}
                              placeholder="Omschrijving element / werk..."
                            />
                            {heeftOpbouw && (
                              <span className="flex items-center gap-0.5 text-[8px] font-medium text-indigo-300 bg-indigo-500/15 border border-indigo-500/25 px-1 py-0.5 rounded leading-none shrink-0 print:hidden">
                                <Sigma size={8} />
                                {p.opbouw.length}
                              </span>
                            )}
                          </div>

                          <InlineInput
                            value={p.hoeveelheid}
                            onChange={v => updatePost(h.id, p.id, { hoeveelheid: v })}
                            placeholder="0"
                            align="right"
                          />
                          <select
                            value={p.eenheid}
                            onChange={e => updatePost(h.id, p.id, { eenheid: e.target.value })}
                            className="bg-transparent text-xs text-white/50 focus:outline-none focus:text-white transition-colors pl-1 print:text-black"
                          >
                            {EENHEDEN.map(e => (
                              <option key={e} value={e} className="bg-zinc-900 text-white">{e}</option>
                            ))}
                          </select>

                          {/* Kostprijs / eenheid — berekend (opbouw) of vrij invulbaar */}
                          {heeftOpbouw ? (
                            <button
                              onClick={() => togglePostOpen(h.id, p.id)}
                              className="flex items-center gap-1 justify-end text-xs text-indigo-200/90 hover:text-indigo-200 transition-colors"
                              title="Berekend uit opbouw — klik om te bewerken"
                            >
                              <Sigma size={9} className="text-indigo-400/70" />
                              <span className="tabular-nums">{fmtEur(ep)}</span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-0.5 justify-end">
                              <span className="text-xs text-white/30 print:hidden">€</span>
                              <InlineInput
                                value={p.eenheidsprijs}
                                onChange={v => updatePost(h.id, p.id, { eenheidsprijs: v })}
                                placeholder="0,00"
                                align="right"
                              />
                            </div>
                          )}

                          <span className={clsx(
                            'text-xs text-right tabular-nums',
                            pt > 0 ? 'text-white/80 print:text-black' : 'text-white/20',
                          )}>
                            {pt > 0 ? fmtEur(pt) : '—'}
                          </span>
                          <button
                            onClick={() => removePost(h.id, p.id)}
                            className="text-white/15 hover:text-red-400 opacity-0 group-hover/post:opacity-100 transition-all print:hidden"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>

                        {/* Opbouw (tussenlaag) */}
                        {p.open && (
                          <OpbouwEditor
                            post={p}
                            onAdd={soort => addOnderdeel(h.id, p.id, soort)}
                            onUpdate={(oId, patch) => updateOnderdeel(h.id, p.id, oId, patch)}
                            onRemove={oId => removeOnderdeel(h.id, p.id, oId)}
                          />
                        )}
                      </div>
                    )
                  })}

                  {/* Add post row */}
                  <button
                    onClick={() => addPost(h.id)}
                    className="flex items-center gap-2 px-4 py-2 text-[11px] text-white/25 hover:text-white/60 transition-colors w-full print:hidden"
                  >
                    <Plus size={11} />
                    Regel toevoegen
                  </button>
                </>
              )}
            </div>
          )
        })}

        {/* Add chapter */}
        <button
          onClick={addHoofdstuk}
          className="flex items-center justify-center gap-2 border border-dashed border-white/10 hover:border-indigo-500/40 hover:text-indigo-400 text-white/30 text-xs font-medium px-4 py-3 rounded-xl transition-all w-full print:hidden"
        >
          <Plus size={13} />
          Hoofdstuk toevoegen
        </button>
      </div>

      {/* Totaaloverzicht */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 print:border print:border-gray-200">
        <h2 className="text-sm font-semibold text-white mb-4 print:text-black">Totaaloverzicht</h2>

        {/* MAMO-verdeling */}
        {mamoTotaal > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
            {SOORTEN.map(s => {
              const bedrag = mamo[s.key]
              const pct = mamoTotaal > 0 ? (bedrag / mamoTotaal) * 100 : 0
              return (
                <div key={s.key} className={clsx('rounded-lg border px-3 py-2', s.cls)}>
                  <p className="text-[9px] uppercase tracking-wider opacity-80">{s.label}</p>
                  <p className="text-sm font-semibold tabular-nums">{fmtEur(bedrag)}</p>
                  <p className="text-[9px] opacity-60">{pct.toFixed(0)}%</p>
                </div>
              )
            })}
          </div>
        )}

        <div className="space-y-1 mb-4">
          {hoofdstukken.map((h, i) => {
            const ht = hoofdstukTotaal(h)
            if (ht === 0) return null
            return (
              <div key={h.id} className="flex justify-between text-xs text-white/50 print:text-black">
                <span className="font-mono text-white/30 print:text-gray-400 mr-2">{i + 1}.</span>
                <span className="flex-1">{h.naam}</span>
                <span className="tabular-nums">{fmtEur(ht)}</span>
              </div>
            )
          })}
        </div>

        <div className="border-t border-white/10 pt-4 space-y-2 print:border-gray-200">
          <div className="flex justify-between text-xs text-white/60 print:text-black">
            <span>Subtotaal (excl. opslag en BTW)</span>
            <span className="tabular-nums font-medium">{fmtEur(subtotaal)}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-white/60 print:hidden">
            <div className="flex items-center gap-2">
              <span>Opslag</span>
              <input
                value={opslag}
                onChange={e => setOpslag(e.target.value)}
                className="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white text-center text-xs focus:outline-none focus:border-white/25"
              />
              <span className="text-white/40">%</span>
            </div>
            <span className="tabular-nums">{fmtEur(opslagBedrag)}</span>
          </div>
          <div className="flex justify-between text-xs text-white/60 print:flex hidden">
            <span>Opslag ({opslag}%)</span>
            <span className="tabular-nums">{fmtEur(opslagBedrag)}</span>
          </div>

          <div className="flex justify-between text-xs text-white/70 border-t border-white/5 pt-2 print:border-gray-100 print:text-black">
            <span>Subtotaal excl. BTW</span>
            <span className="tabular-nums font-medium">{fmtEur(exclBtw)}</span>
          </div>

          <div className="flex items-center justify-between text-xs text-white/60 print:hidden">
            <div className="flex items-center gap-2">
              <span>BTW</span>
              <input
                value={btwPct}
                onChange={e => setBtwPct(e.target.value)}
                className="w-12 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white text-center text-xs focus:outline-none focus:border-white/25"
              />
              <span className="text-white/40">%</span>
            </div>
            <span className="tabular-nums">{fmtEur(btwBedrag)}</span>
          </div>
          <div className="flex justify-between text-xs text-white/60 print:flex hidden">
            <span>BTW ({btwPct}%)</span>
            <span className="tabular-nums">{fmtEur(btwBedrag)}</span>
          </div>

          <div className="flex justify-between border-t border-white/10 pt-3 print:border-gray-300">
            <span className="text-sm font-bold text-white print:text-black">Totaal incl. BTW</span>
            <span className="text-sm font-bold text-white tabular-nums print:text-black">
              {fmtEur(totaalInclBtw)}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          nav, aside, [data-sidebar], header { display: none !important; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:flex { display: flex !important; }
        }
      `}</style>
    </div>
  )
}
