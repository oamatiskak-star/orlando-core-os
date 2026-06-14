'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calculator, ChevronDown, ChevronRight, Plus, Trash2,
  Printer, ArrowLeft, Pencil, Check, Copy, ChevronUp, Download,
} from 'lucide-react'
import clsx from 'clsx'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Post {
  id: string
  omschrijving: string
  hoeveelheid: string
  eenheid: string
  eenheidsprijs: string
}

interface Hoofdstuk {
  id: string
  naam: string
  posten: Post[]
  open: boolean
}

// ─── Pre-built combis (2Jours-stijl, uitgebreid) ─────────────────────────────

const COMBIS: Record<string, Omit<Post, 'id'>[]> = {

  // ── Ruwbouw ──────────────────────────────────────────────────────────────────
  Sloopwerk: [
    { omschrijving: 'Sloop bestaande vloer (incl. afvoer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '12.00' },
    { omschrijving: 'Sloop binnenwanden (incl. afvoer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '18.00' },
    { omschrijving: 'Sloop dakbeschot / pannen', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '22.00' },
    { omschrijving: 'Sloop badkamerinstallatie compleet', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '850.00' },
    { omschrijving: 'Sloop keuken (incl. apparatuur)', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '680.00' },
    { omschrijving: 'Breekwerk beton / fundering', hoeveelheid: '', eenheid: 'm³', eenheidsprijs: '180.00' },
    { omschrijving: 'Afvoer puin (container 6 m³)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '390.00' },
  ],

  'Fundering & Grondwerk': [
    { omschrijving: 'Grondwerk / ontgraving', hoeveelheid: '', eenheid: 'm³', eenheidsprijs: '28.00' },
    { omschrijving: 'Grond afvoeren (per vracht)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '320.00' },
    { omschrijving: 'Betonnen strookfundering', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '185.00' },
    { omschrijving: 'Vloerplaat beton 15 cm (incl. wapening)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00' },
    { omschrijving: 'Poer beton (per stuk)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '380.00' },
    { omschrijving: 'Onderstopsel bestaande fundering', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '280.00' },
    { omschrijving: 'Kruipruimte drainage', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '45.00' },
    { omschrijving: 'Zandbed / aanvulzand', hoeveelheid: '', eenheid: 'm³', eenheidsprijs: '38.00' },
  ],

  Metselwerk: [
    { omschrijving: 'Binnenwand metselwerk 10 cm', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00' },
    { omschrijving: 'Buitengevel metselwerk 21 cm (spouw)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '165.00' },
    { omschrijving: 'Borstwering / latei metselwerk', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '120.00' },
    { omschrijving: 'Schoorsteenkanaal metselwerk', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '320.00' },
    { omschrijving: 'Koppelstenen / ankers spouwmuur', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '4.50' },
    { omschrijving: 'Gevelvoegen bijwerken', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '38.00' },
    { omschrijving: 'Betonnen lateibalk plaatsen', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '280.00' },
  ],

  Betonwerk: [
    { omschrijving: 'Gestort beton constructievloer (15 cm)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00' },
    { omschrijving: 'Betonnen wand bekisten en storten', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '185.00' },
    { omschrijving: 'Prefab betonnen element plaatsen', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '650.00' },
    { omschrijving: 'Betonnen trap gieten', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '2800.00' },
    { omschrijving: 'Betonherstel (reparatiemortel)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '65.00' },
    { omschrijving: 'Wapeningsstaal (incl. verbinden)', hoeveelheid: '', eenheid: 'kg', eenheidsprijs: '2.20' },
  ],

  Riolering: [
    { omschrijving: 'PVC-rioolbuis ø110 binnenriolering (incl. bochtstukken)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '48.00' },
    { omschrijving: 'PVC-rioolbuis ø160 buitenriolering', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '68.00' },
    { omschrijving: 'PVC-rioolbuis ø200 hoofdriool', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '95.00' },
    { omschrijving: 'Kolkput plaatsen (incl. rooster)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '420.00' },
    { omschrijving: 'Putje / cleanout aansluiting', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '185.00' },
    { omschrijving: 'Pompput met vlotter', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1850.00' },
    { omschrijving: 'Infiltratiekrat plaatsen (incl. grond)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '320.00' },
    { omschrijving: 'Ontstoppen riolering', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '285.00' },
  ],

  Asbestsanering: [
    { omschrijving: 'Asbestinventarisatie (RI&E-rapport)', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '650.00' },
    { omschrijving: 'Sanering asbestcement-platen (risicoklasse 1)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '45.00' },
    { omschrijving: 'Sanering asbestcement-platen (risicoklasse 2)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00' },
    { omschrijving: 'Sanering asbestvezels / hechtgebonden', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '120.00' },
    { omschrijving: 'Sanering asbestleidingen / bochtstukken', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '85.00' },
    { omschrijving: 'Afvoer en verwerking asbest (gecertificeerd)', hoeveelheid: '', eenheid: 'ton', eenheidsprijs: '980.00' },
  ],

  // ── Dak ──────────────────────────────────────────────────────────────────────
  Dakwerk: [
    { omschrijving: 'Dakpannen vervangen (incl. tengels, lat)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00' },
    { omschrijving: 'Bitumen dakbedekking plat dak (2-laags)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '85.00' },
    { omschrijving: 'EPDM dakbedekking plat dak', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '78.00' },
    { omschrijving: 'Dakgoot vervangen (zink)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '68.00' },
    { omschrijving: 'Hemelwaterafvoer PVC ø80 (incl. klemmen)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '38.00' },
    { omschrijving: 'Nokvorst vernieuwen (incl. mortel)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '95.00' },
    { omschrijving: 'Dakrenovatie incl. ondervloer', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '145.00' },
    { omschrijving: 'Dakbeschot hout (OSB/vuren)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '42.00' },
    { omschrijving: 'Loodwerk afdichting (borstweringen, schoorstenen)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '95.00' },
  ],

  'Dakkapel & Dakraam': [
    { omschrijving: 'Dakkapel plaatsen (hout, standaard 3 m breed)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '14500.00' },
    { omschrijving: 'Dakraam Velux 78×98 incl. montage + kraag', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1450.00' },
    { omschrijving: 'Dakraam Velux 78×118 incl. montage + kraag', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1750.00' },
    { omschrijving: 'Dakraam Velux 114×118 incl. montage + kraag', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '2200.00' },
    { omschrijving: 'Lood rondom dakraam / dakkapel', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '380.00' },
    { omschrijving: 'Dakkapel schilderwerk (buiten)', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '1200.00' },
    { omschrijving: 'Uitbouw kap (dakhelling wijzigen)', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '8500.00' },
  ],

  Isolatie: [
    { omschrijving: 'Spouwmuurisolatie (ingeblazen EPS)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '28.00' },
    { omschrijving: 'Dakisolatie PIR 10 cm', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '38.00' },
    { omschrijving: 'Dakisolatie PIR 14 cm', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '48.00' },
    { omschrijving: 'Vloerisolatie EPS (onder dekvloer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '35.00' },
    { omschrijving: 'Binnenisolatie wand (gipskarton + rockwool)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '65.00' },
    { omschrijving: 'Gevelisolatie buitenzijde (composiet systeem)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '120.00' },
    { omschrijving: 'HR++ glas (vervangen beglazing)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '185.00' },
    { omschrijving: 'Triple glas (vervangen beglazing)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '280.00' },
    { omschrijving: 'Kruipruimte isolatie (folie + EPS)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '42.00' },
  ],

  // ── Gevel & Kozijnen ──────────────────────────────────────────────────────────
  Gevelrenovatie: [
    { omschrijving: 'Gevel reinigen (hogedrukreiniger)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '12.00' },
    { omschrijving: 'Gevelvoegen bijwerken', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '38.00' },
    { omschrijving: 'Betonherstel buitengevel', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '75.00' },
    { omschrijving: 'Gevelisolatie met pleisterlaag (ETICS-systeem)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '135.00' },
    { omschrijving: 'Gevelbekleding hout (siberisch lariks)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00' },
    { omschrijving: 'Gevelbekleding composiet / HPL', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '145.00' },
    { omschrijving: 'Gevelnet / klimop verwijderen', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '18.00' },
  ],

  'Kozijnen & Deuren': [
    { omschrijving: 'Kunststof raamkozijn HR++ glas', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1200.00' },
    { omschrijving: 'Aluminium kozijn HR++ glas', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1650.00' },
    { omschrijving: 'Voordeur compleet (incl. hang- en sluitwerk)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '2800.00' },
    { omschrijving: 'Achterdeur compleet (incl. kozijn)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '2200.00' },
    { omschrijving: 'Binnendeur (incl. kozijn, hang- en sluitwerk)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '480.00' },
    { omschrijving: 'Schuifpui 2-delig aluminium HR++', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '3500.00' },
    { omschrijving: 'Schuifpui 3-delig aluminium HR++', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '5200.00' },
    { omschrijving: 'Garagedeur sectionaal (incl. motor)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '3800.00' },
    { omschrijving: 'Kozijnen kitten (buiten)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '65.00' },
  ],

  // ── Afbouw ────────────────────────────────────────────────────────────────────
  'Stucwerk & Plafonds': [
    { omschrijving: 'Glad stucwerk wanden (2-laags)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '22.00' },
    { omschrijving: 'Glad stucwerk plafond', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '28.00' },
    { omschrijving: 'Buitengevel spachtelputz', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '45.00' },
    { omschrijving: 'Cementdekvloer / egaline', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '35.00' },
    { omschrijving: 'Gipskarton wand op regelwerk', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '58.00' },
    { omschrijving: 'Systeemplafond (600×600 cassettes)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '48.00' },
    { omschrijving: 'Gips scheidingswand (glaswol incl.)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '75.00' },
    { omschrijving: 'Corniche / plafondlijst stucwerk', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '32.00' },
  ],

  Tegelwerk: [
    { omschrijving: 'Wandtegels badkamer (incl. tegellijm en voeg)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '85.00' },
    { omschrijving: 'Vloertegels badkamer / toilet', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '78.00' },
    { omschrijving: 'Vloertegels keuken / woonkamer', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '65.00' },
    { omschrijving: 'Grote formaat tegel ≥60×60 cm', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '110.00' },
    { omschrijving: 'Cementlook vloertegel', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '98.00' },
    { omschrijving: 'Mozaïektegels', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '145.00' },
    { omschrijving: 'Tegelplint (5 cm)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '28.00' },
    { omschrijving: 'Bestaande tegels verwijderen (incl. afvoer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '22.00' },
  ],

  Vloerwerk: [
    { omschrijving: 'Laminaatvloer leggen (incl. ondervloer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '28.00' },
    { omschrijving: 'PVC-vloer leggen (incl. ondervloer)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '32.00' },
    { omschrijving: 'Parketvloer leggen (incl. schuren en lakken)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '65.00' },
    { omschrijving: 'Houten vloer schuren en lakken (bestaand)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '28.00' },
    { omschrijving: 'Gietvloer / Ardex woonkamer', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00' },
    { omschrijving: 'Betonlook gietvloer (2-laags)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '110.00' },
    { omschrijving: 'Epoxyvloer (garage / bedrijfsruimte)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '45.00' },
    { omschrijving: 'Tapijt leggen (incl. vilt)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '22.00' },
    { omschrijving: 'Plinten MDF lakken en plaatsen', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '18.00' },
  ],

  Schilderwerk: [
    { omschrijving: 'Binnenwanden schilderwerk (2 lagen verf)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '12.00' },
    { omschrijving: 'Plafonds schilderwerk', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '15.00' },
    { omschrijving: 'Kozijnen buiten schilderwerk', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '280.00' },
    { omschrijving: 'Deuren schilderwerk (2 zijden)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '145.00' },
    { omschrijving: 'Behangen wanden', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '25.00' },
    { omschrijving: 'Houtrot herstel kozijn (inclusief kit)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '180.00' },
    { omschrijving: 'Beitswerk hout buiten', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '22.00' },
    { omschrijving: 'Grondverf / primer aanbrengen', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '8.00' },
  ],

  Timmerwerk: [
    { omschrijving: 'Plinten plaatsen (MDF, lakklaar)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '18.00' },
    { omschrijving: 'Dorpels plaatsen', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '95.00' },
    { omschrijving: 'Kozijnen repareren / kitten', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '145.00' },
    { omschrijving: 'Wandpanelen / lambrisering (MDF)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '68.00' },
    { omschrijving: 'Trapleuning monteren', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '85.00' },
    { omschrijving: 'Houten vliesgevel (incl. regelwerk)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '110.00' },
    { omschrijving: 'Koof / afwerking verborgen leiding', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '55.00' },
    { omschrijving: 'Maatwerk kastruimte / berging', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '2500.00' },
  ],

  // ── Installaties ─────────────────────────────────────────────────────────────
  Elektra: [
    { omschrijving: 'Groep (incl. leiding, buis, aansluiting)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '380.00' },
    { omschrijving: 'Wandcontactdoos enkel', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '85.00' },
    { omschrijving: 'Wandcontactdoos dubbel', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '115.00' },
    { omschrijving: 'LED-inbouwarmatuur', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '145.00' },
    { omschrijving: 'Meterkast vernieuwen (16-groepen)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1250.00' },
    { omschrijving: 'Meterkast uitbreiden (per groep)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '195.00' },
    { omschrijving: 'Laadpaal EV thuis (incl. groep + aansluiting)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1850.00' },
    { omschrijving: 'TV/data-aansluiting CAT6', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '125.00' },
    { omschrijving: 'Buitenlamp / buitenstopcontact', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '165.00' },
    { omschrijving: 'Domotica schakelaar / dimmer', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '285.00' },
    { omschrijving: 'Rookmelder plaatsen', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '85.00' },
  ],

  Loodgieterij: [
    { omschrijving: 'Aansluitpunt warm- en koudwaterleiding', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '245.00' },
    { omschrijving: 'Inloopdouche compleet (incl. kraan)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1850.00' },
    { omschrijving: 'Toilet compleet (incl. reservoir en zitting)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '680.00' },
    { omschrijving: 'Wastafel incl. kraan en sifon', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '520.00' },
    { omschrijving: 'Ligbad incl. kraan (ingebouwd)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '2850.00' },
    { omschrijving: 'Radiator aansluiten (incl. thermostaatknop)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '320.00' },
    { omschrijving: 'Vloerverwarming (incl. verdeler)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '55.00' },
    { omschrijving: 'Buitenkraan aansluiten', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '185.00' },
    { omschrijving: 'Wasmachineaansluiting (warm, koud, afvoer)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '245.00' },
    { omschrijving: 'Waterleiding doortrekken (per m¹)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '42.00' },
  ],

  'CV-installatie': [
    { omschrijving: 'CV-ketel vervangen (combiketel, incl. montage)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '3200.00' },
    { omschrijving: 'Warmtepomp lucht/water aansluiten', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '8500.00' },
    { omschrijving: 'Hybride warmtepomp (incl. ketel)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '6800.00' },
    { omschrijving: 'Radiator vervangen (incl. ontluchten)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '385.00' },
    { omschrijving: 'CV-leiding aanleggen (per m¹, inbouw)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '48.00' },
    { omschrijving: 'Thermostaatventiel vervangen', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '95.00' },
    { omschrijving: 'Cv-installatie onderhoud / service', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '285.00' },
    { omschrijving: 'Expansievat vervangen', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '280.00' },
  ],

  'Ventilatie & WTW': [
    { omschrijving: 'Mechanische ventilatie-unit (badkamer/toilet)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '380.00' },
    { omschrijving: 'WTW-unit plaatsen (incl. aansluiting)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '2850.00' },
    { omschrijving: 'WTW-systeem compleet (unit + kanalen + roosters)', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '5800.00' },
    { omschrijving: 'Kanaalwerk ventilatiesysteem (per m¹)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '38.00' },
    { omschrijving: 'Ventilatieroosters plaatsen', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '95.00' },
    { omschrijving: 'Dakdoorvoer ventilatie', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '285.00' },
    { omschrijving: 'Balansventilatie filter vervangen', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '85.00' },
  ],

  Zonnepanelen: [
    { omschrijving: 'Zonnepaneel 400-430 Wp (incl. montage op dak)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '580.00' },
    { omschrijving: 'Zonnepaneel 450-500 Wp premium', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '720.00' },
    { omschrijving: 'Micro-omvormer per paneel', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '185.00' },
    { omschrijving: 'String-omvormer 3-fase (incl. installatie)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '1850.00' },
    { omschrijving: 'DC-bekabeling en kabelgoten', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '380.00' },
    { omschrijving: 'Thuisbatterij 5 kWh (incl. installatie)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '5800.00' },
    { omschrijving: 'Steiger dagwerk (voor paneelmontage)', hoeveelheid: '', eenheid: 'dag', eenheidsprijs: '450.00' },
  ],

  // ── Complete verbouw ──────────────────────────────────────────────────────────
  'Badkamer compleet': [
    { omschrijving: 'Sloop badkamer compleet', hoeveelheid: '1', eenheid: 'ls', eenheidsprijs: '850.00' },
    { omschrijving: 'Wandtegels badkamer', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '85.00' },
    { omschrijving: 'Vloertegels badkamer', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '78.00' },
    { omschrijving: 'Inloopdouche compleet (incl. kraan)', hoeveelheid: '1', eenheid: 'st', eenheidsprijs: '1850.00' },
    { omschrijving: 'Toilet compleet (incl. reservoir)', hoeveelheid: '1', eenheid: 'st', eenheidsprijs: '680.00' },
    { omschrijving: 'Wastafel incl. kraan en sifon', hoeveelheid: '1', eenheid: 'st', eenheidsprijs: '520.00' },
    { omschrijving: 'Loodgieterij aansluitpunten', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '245.00' },
    { omschrijving: 'Glad stucwerk resterende wanden', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '22.00' },
    { omschrijving: 'Elektrische groep badkamer', hoeveelheid: '1', eenheid: 'st', eenheidsprijs: '380.00' },
  ],

  Keukenplaatsing: [
    { omschrijving: 'Demonteren bestaande keuken (incl. afvoer)', hoeveelheid: '1', eenheid: 'ls', eenheidsprijs: '580.00' },
    { omschrijving: 'Monteren nieuwe keukenblokken (incl. stellage)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '185.00' },
    { omschrijving: 'Aanrechtblad opmeten en monteren', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '145.00' },
    { omschrijving: 'Inbouwapparatuur aansluiten (elektra)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '145.00' },
    { omschrijving: 'Gootsteen / kraan aansluiten', hoeveelheid: '1', eenheid: 'st', eenheidsprijs: '245.00' },
    { omschrijving: 'Keuken kitten (achter- en bovenzijde)', hoeveelheid: '1', eenheid: 'ls', eenheidsprijs: '185.00' },
    { omschrijving: 'Spatwand tegels', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '85.00' },
    { omschrijving: 'Afzuigkap aansluiten (incl. kanaal)', hoeveelheid: '1', eenheid: 'st', eenheidsprijs: '320.00' },
  ],

  'Trap & Balustrade': [
    { omschrijving: 'Houten rechte trap compleet (incl. plaatsing)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '3800.00' },
    { omschrijving: 'Kwartslag trap hout compleet', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '5500.00' },
    { omschrijving: 'Trap renoveren (nieuwe bekleding op bestaand)', hoeveelheid: '', eenheid: 'ls', eenheidsprijs: '1850.00' },
    { omschrijving: 'Stalen leuning / balustrade (incl. montage)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '320.00' },
    { omschrijving: 'RVS spijlenbalustrade', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '485.00' },
    { omschrijving: 'Houten trapleuning', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '95.00' },
    { omschrijving: 'Glazen balustrade (incl. profielen)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '650.00' },
  ],

  // ── Buiten ────────────────────────────────────────────────────────────────────
  'Bestrating & Terras': [
    { omschrijving: 'Betonstraatstenen 21×10 (incl. zandbed)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '42.00' },
    { omschrijving: 'Betontegels 50×50 cm (incl. zandbed)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '48.00' },
    { omschrijving: 'Klinkers roodbruin (incl. zandbed)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '55.00' },
    { omschrijving: 'Oprit gravel / steenslag', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '28.00' },
    { omschrijving: 'Terrasplaten 60×60 (incl. tegelvoeters)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '75.00' },
    { omschrijving: 'Houten vlonder terras (bangkirai)', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '95.00' },
    { omschrijving: 'Drainage goot plaatsen (incl. rooster)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '68.00' },
    { omschrijving: 'Opsluitband plaatsen', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '28.00' },
    { omschrijving: 'Bestaande bestrating opbreken en afvoeren', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '18.00' },
  ],

  Tuinafscheiding: [
    { omschrijving: 'Betonnen tuinpaal (incl. fundering)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '65.00' },
    { omschrijving: 'Schutting hout gedompeld (incl. palen)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '95.00' },
    { omschrijving: 'Schutting beton (incl. palen)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '120.00' },
    { omschrijving: 'Hekwerk staal verzinkt', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '185.00' },
    { omschrijving: 'Poort staal (incl. montage)', hoeveelheid: '', eenheid: 'st', eenheidsprijs: '950.00' },
    { omschrijving: 'Haag planten (carpinus, per m¹)', hoeveelheid: '', eenheid: 'm¹', eenheidsprijs: '48.00' },
  ],
}

// ─── Combi-groepen voor gegroepeerd menu ──────────────────────────────────────

const COMBI_GROEPEN: { label: string; emoji: string; items: string[] }[] = [
  {
    label: 'Ruwbouw',
    emoji: '🏗',
    items: ['Sloopwerk', 'Fundering & Grondwerk', 'Metselwerk', 'Betonwerk', 'Riolering', 'Asbestsanering'],
  },
  {
    label: 'Dak',
    emoji: '🏠',
    items: ['Dakwerk', 'Dakkapel & Dakraam', 'Isolatie'],
  },
  {
    label: 'Gevel & Kozijnen',
    emoji: '🪟',
    items: ['Gevelrenovatie', 'Kozijnen & Deuren'],
  },
  {
    label: 'Afbouw',
    emoji: '🛁',
    items: ['Stucwerk & Plafonds', 'Tegelwerk', 'Vloerwerk', 'Schilderwerk', 'Timmerwerk'],
  },
  {
    label: 'Installaties',
    emoji: '⚡',
    items: ['Elektra', 'Loodgieterij', 'CV-installatie', 'Ventilatie & WTW', 'Zonnepanelen'],
  },
  {
    label: 'Complete verbouw',
    emoji: '🔧',
    items: ['Badkamer compleet', 'Keukenplaatsing', 'Trap & Balustrade'],
  },
  {
    label: 'Buiten',
    emoji: '🌿',
    items: ['Bestrating & Terras', 'Tuinafscheiding'],
  },
]

const EENHEDEN = ['m²', 'm³', 'm¹', 'st', 'uur', 'dag', 'ls', 'kg', 'ton', 'set']

// ─── Helpers ──────────────────────────────────────────────────────────────────

const genId = () => Math.random().toString(36).slice(2, 9)

function legePost(): Post {
  return { id: genId(), omschrijving: '', hoeveelheid: '', eenheid: 'm²', eenheidsprijs: '' }
}

function parseNum(v: string): number {
  return parseFloat(v.replace(',', '.')) || 0
}

function postTotaal(p: Post): number {
  return parseNum(p.hoeveelheid) * parseNum(p.eenheidsprijs)
}

function hoofdstukTotaal(h: Hoofdstuk): number {
  return h.posten.reduce((s, p) => s + postTotaal(p), 0)
}

function fmtEur(n: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n)
}

function fmtNum(n: number): string {
  if (n === 0) return '—'
  return new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
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

  const bundelingen = hoofdstukken.map((h, hIdx) => {
    const ht = hoofdstukTotaal(h)
    const regels = h.posten
      .filter(p => p.omschrijving)
      .map((p, pIdx) =>
        `      <BEGROTINGSREGEL CODE="${hIdx + 1}.${pIdx + 1}" OMSCHRIJVING="${esc(p.omschrijving)}" HOEVEELHEID_EENHEID="${esc(p.eenheid)}" HOEVEELHEID="${parseNum(p.hoeveelheid)}" INZET="1" HOEVEELHEID_FACTOR="1" MATERIAALPRIJS="${parseNum(p.eenheidsprijs)}" BTW="" />`
      ).join('\n')
    return `    <BUNDELING CODE="${hIdx + 1}" OMSCHRIJVING="${esc(h.naam)}" EENHEID="PST" TERUGDEEL_HOEVEELHEID="1" UREN="0" LOONKOSTEN="0" MATERIAALKOSTEN="${ht.toFixed(5)}" MATERIEELKOSTEN="0" ONDERAANNEMING="0">
${regels}
    </BUNDELING>`
  }).join('\n')

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<CUF xmlns="x-schema:CufSchema.xml" AANMAAKDATUMTIJD="${nu}">
  <PROJECTGEGEVENS CUF_VERSIE="4.003" SYSTEEMHUIS="Orlando" AANMAAKDATUM="${datum}" PROJECTNUMMER="${esc(projectNummer)}" PROJECTNAAM="${esc(projectNaam)}" CALCULATOR="Orlando Core OS" OPDRACHTGEVER="${esc(klant)}" VALUTA="EUR" EURO_KOERS="1" OPSLAG_PCT="${opslag}" BTW_PCT="${btwPct}" />
  <BEGROTING UREN="0" LOONKOSTEN="0" MATERIAALKOSTEN="${subtotaal.toFixed(5)}" MATERIEELKOSTEN="0" ONDERAANNEMING="0" OVERIGE_KOSTEN="0">
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

    const bundelingen = Array.from(doc.querySelectorAll('BEGROTING > BUNDELING'))
    const hoofdstukken: Hoofdstuk[] = bundelingen.map(b => {
      const naam = b.getAttribute('OMSCHRIJVING') ?? 'Hoofdstuk'
      const posten: Post[] = Array.from(b.querySelectorAll(':scope > BEGROTINGSREGEL'))
        .map(r => ({
          id: genId(),
          omschrijving: r.getAttribute('OMSCHRIJVING') ?? '',
          hoeveelheid: r.getAttribute('HOEVEELHEID') ?? '',
          eenheid: r.getAttribute('HOEVEELHEID_EENHEID') ?? 'm²',
          eenheidsprijs: (
            r.getAttribute('MATERIAALPRIJS') ||
            r.getAttribute('ONDERAANNEMINGSPRIJS') ||
            r.getAttribute('UUR_TARIEF') ||
            ''
          ),
        }))
        .filter(p => p.omschrijving)
      return { id: genId(), naam, posten: posten.length ? posten : [legePost()], open: true }
    })

    return {
      projectNaam,
      projectNummer,
      klant,
      opslag,
      btwPct,
      hoofdstukken: hoofdstukken.length
        ? hoofdstukken
        : [{ id: genId(), naam: 'Hoofdstuk 1', posten: [legePost()], open: true }],
    }
  } catch {
    return null
  }
}

// ─── Inline edit input ────────────────────────────────────────────────────────

function InlineInput({
  value, onChange, placeholder, className, align = 'left', type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  align?: 'left' | 'right'
  type?: string
}) {
  return (
    <input
      type={type}
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalculatorPage() {
  const router = useRouter()

  const [projectNaam, setProjectNaam] = useState('Nieuwe calculatie')
  const [editingNaam, setEditingNaam] = useState(false)
  const [projectNummer, setProjectNummer] = useState(
    `CAL-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`
  )
  const [klant, setKlant] = useState('')
  const [datum] = useState(
    new Date().toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' })
  )
  const [hoofdstukken, setHoofdstukken] = useState<Hoofdstuk[]>([
    {
      id: genId(),
      naam: 'Hoofdstuk 1',
      open: true,
      posten: [legePost()],
    },
  ])
  const [opslag, setOpslag] = useState('10')
  const [btwPct, setBtwPct] = useState('21')
  const [combiMenuFor, setCombiMenuFor] = useState<string | null>(null)
  const [importFout, setImportFout] = useState<string | null>(null)
  const combiRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Close combi menu on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (combiRef.current && !combiRef.current.contains(e.target as Node)) {
        setCombiMenuFor(null)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  // ── Totals ──
  const subtotaal = hoofdstukken.reduce((s, h) => s + hoofdstukTotaal(h), 0)
  const opslagBedrag = subtotaal * (parseNum(opslag) / 100)
  const exclBtw = subtotaal + opslagBedrag
  const btwBedrag = exclBtw * (parseNum(btwPct) / 100)
  const totaalInclBtw = exclBtw + btwBedrag

  // ── Hoofdstuk handlers ──
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

  // ── Post handlers ──
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

  // ── CUF export ──
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

  // ── CUF import ──
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

  // ── Combi insert ──
  const insertCombi = (hId: string, naam: string) => {
    const posten = COMBIS[naam].map(c => ({ id: genId(), ...c }))
    updateHoofdstuk(hId, { naam, posten })
    setCombiMenuFor(null)
  }

  // ── Duplicate chapter ──
  const duplicateHoofdstuk = (h: Hoofdstuk) =>
    setHoofdstukken(prev => {
      const idx = prev.findIndex(x => x.id === h.id)
      const copy: Hoofdstuk = {
        ...h,
        id: genId(),
        naam: `${h.naam} (kopie)`,
        posten: h.posten.map(p => ({ ...p, id: genId() })),
      }
      const next = [...prev]
      next.splice(idx + 1, 0, copy)
      return next
    })

  return (
    <div className="space-y-4 pb-12 print:pb-0">

      {/* ── Header ── */}
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
              <button
                onClick={() => setEditingNaam(true)}
                className="flex items-center gap-1.5 group"
              >
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

      {/* Hidden file input for CUF import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xml,.cuf"
        onChange={laadCUFBestand}
        className="hidden"
      />

      {/* Import error */}
      {importFout && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-red-400">{importFout}</p>
          <button onClick={() => setImportFout(null)} className="text-red-400/60 hover:text-red-400 ml-4">
            <Trash2 size={12} />
          </button>
        </div>
      )}

      {/* ── Print header (only visible when printing) ── */}
      <div className="hidden print:block mb-6">
        <h1 className="text-2xl font-bold text-black">{projectNaam}</h1>
        <p className="text-sm text-gray-500">{projectNummer} · {datum}{klant ? ` · ${klant}` : ''}</p>
      </div>

      {/* ── Meta row ── */}
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

      {/* ── Chapters ── */}
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

                {/* Combi button */}
                <div className="relative print:hidden" ref={combiMenuFor === h.id ? combiRef : undefined}>
                  <button
                    onClick={() => setCombiMenuFor(combiMenuFor === h.id ? null : h.id)}
                    className={clsx(
                      'text-[10px] border px-2 py-1 rounded transition-all',
                      combiMenuFor === h.id
                        ? 'text-indigo-300 border-indigo-500/50 bg-indigo-500/10'
                        : 'text-indigo-400/60 border-indigo-500/20 opacity-0 group-hover/hdr:opacity-100 hover:text-indigo-300 hover:border-indigo-500/50',
                    )}
                  >
                    Combi invoegen
                  </button>
                  {combiMenuFor === h.id && (
                    <div className="absolute right-0 top-9 z-50 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl w-64 py-2 overflow-y-auto max-h-[70vh]">
                      {COMBI_GROEPEN.map(groep => (
                        <div key={groep.label}>
                          <p className="text-[9px] text-white/30 uppercase tracking-wider px-3 pt-2.5 pb-1 flex items-center gap-1.5">
                            <span>{groep.emoji}</span>
                            {groep.label}
                          </p>
                          {groep.items.map(c => (
                            <button
                              key={c}
                              onClick={() => insertCombi(h.id, c)}
                              className="w-full text-left px-4 py-1.5 text-xs text-white/60 hover:text-white hover:bg-white/5 transition-colors"
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chapter actions */}
                <div className="flex items-center gap-0.5 opacity-0 group-hover/hdr:opacity-100 transition-opacity print:hidden">
                  <button
                    onClick={() => moveHoofdstuk(h.id, -1)}
                    className="p-1 text-white/20 hover:text-white/60 transition-colors"
                    title="Omhoog"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    onClick={() => moveHoofdstuk(h.id, 1)}
                    className="p-1 text-white/20 hover:text-white/60 transition-colors"
                    title="Omlaag"
                  >
                    <ChevronDown size={12} />
                  </button>
                  <button
                    onClick={() => duplicateHoofdstuk(h)}
                    className="p-1 text-white/20 hover:text-white/60 transition-colors"
                    title="Dupliceren"
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    onClick={() => removeHoofdstuk(h.id)}
                    className="p-1 text-white/20 hover:text-red-400 transition-colors"
                    title="Verwijderen"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Posts */}
              {h.open && (
                <>
                  {/* Column headers */}
                  <div className="grid items-center gap-2 px-4 py-2 text-[9px] text-white/25 uppercase tracking-widest border-b border-white/[0.03] print:text-gray-400 print:border-gray-100"
                    style={{ gridTemplateColumns: '1fr 72px 68px 100px 90px 24px' }}
                  >
                    <span>Omschrijving</span>
                    <span className="text-right">Hoeveelheid</span>
                    <span className="pl-1">Eenheid</span>
                    <span className="text-right">Prijs / eenheid</span>
                    <span className="text-right">Totaal</span>
                    <span />
                  </div>

                  {h.posten.map((p, pIdx) => {
                    const pt = postTotaal(p)
                    return (
                      <div
                        key={p.id}
                        className="grid items-center gap-2 px-4 py-1.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group/post print:border-b print:border-gray-50"
                        style={{ gridTemplateColumns: '1fr 72px 68px 100px 90px 24px' }}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-white/20 font-mono w-4 shrink-0 print:text-gray-400">
                            {hIdx + 1}.{pIdx + 1}
                          </span>
                          <InlineInput
                            value={p.omschrijving}
                            onChange={v => updatePost(h.id, p.id, { omschrijving: v })}
                            placeholder="Omschrijving werk..."
                          />
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
                        <div className="flex items-center gap-0.5 justify-end">
                          <span className="text-xs text-white/30 print:hidden">€</span>
                          <InlineInput
                            value={p.eenheidsprijs}
                            onChange={v => updatePost(h.id, p.id, { eenheidsprijs: v })}
                            placeholder="0,00"
                            align="right"
                          />
                        </div>
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

      {/* ── Totaaloverzicht ── */}
      <div className="bg-white/[0.06] border border-white/5 rounded-xl p-5 print:border print:border-gray-200">
        <h2 className="text-sm font-semibold text-white mb-4 print:text-black">Totaaloverzicht</h2>

        {/* Per-chapter breakdown */}
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

        {/* Calculations */}
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

      {/* ── Print styles ── */}
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
