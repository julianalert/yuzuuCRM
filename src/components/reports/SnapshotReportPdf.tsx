/**
 * SnapshotReportPdf.tsx
 *
 * Mirror of SnapshotReport.tsx using @react-pdf/renderer primitives.
 * Returns a `Document` that the PDF API route can stream as a PDF blob.
 *
 * The visual structure intentionally tracks the HTML version so the
 * downloaded PDF matches what the agency sees on the share page.
 */

import { Document, Page, Text, View, StyleSheet, Image } from './pdf-primitives'
import type { SnapshotPayload } from '@/lib/agent/snapshot-report'
import type { SnapshotReportBranding } from './SnapshotReport'

export interface SnapshotReportPdfProps {
  payload: SnapshotPayload
  branding: SnapshotReportBranding
  lead: {
    name: string | null
    category: string | null
    address: string | null
    rating: number | null
    review_count: number | null
  }
  generatedAt: string
}

const SERVICE_LABELS: Record<string, string> = {
  web:               'Website',
  seo:               'SEO',
  ads:               'Paid ads',
  social:            'Social',
  rep:               'Reputation',
  email:             'Email',
  booking:           'Booking',
  'ai-receptionist': 'AI receptionist',
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
    fontFamily: 'Helvetica',
    fontSize: 11,
    color: '#1A1916',
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E6E1',
  },
  logoBox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#1A1916',
    color: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  logoImg: {
    width: 28,
    height: 28,
    marginRight: 10,
  },
  agencyName: { fontSize: 11, fontWeight: 700 },
  smallMuted: { fontSize: 9, color: '#6B6860', marginTop: 2 },
  date: { fontSize: 9, color: '#A8A49C', marginLeft: 'auto' },
  category: {
    fontSize: 9, color: '#6B6860',
    textTransform: 'uppercase', letterSpacing: 1,
    marginBottom: 4,
  },
  h1: { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  headline: { fontSize: 12.5, color: '#4A4742', marginBottom: 18 },
  sectionTitle: {
    fontSize: 10, fontWeight: 700, color: '#1A1916',
    textTransform: 'uppercase', letterSpacing: 1.4,
    marginTop: 14, marginBottom: 10,
  },
  snapshotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  snapshotCell: {
    width: '31%',
    padding: 8,
    backgroundColor: '#F7F6F3',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E8E6E1',
    marginBottom: 6,
  },
  cellLabel: { fontSize: 8, color: '#6B6860', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700 },
  cellValueGood: { fontSize: 12, fontWeight: 700, color: '#1a7a3a', marginTop: 3 },
  cellValueNeutral: { fontSize: 12, fontWeight: 700, color: '#3a3a3a', marginTop: 3 },
  cellValueBad: { fontSize: 12, fontWeight: 700, color: '#a83a35', marginTop: 3 },
  cellBenchmark: { fontSize: 8.5, color: '#6B6860', marginTop: 4 },
  obsRow: { flexDirection: 'row', marginBottom: 8 },
  obsNum: {
    width: 16, height: 16, borderRadius: 999,
    backgroundColor: '#1A1916', color: '#fff',
    fontSize: 8, fontWeight: 700,
    textAlign: 'center', paddingTop: 3,
    marginRight: 8,
  },
  obsTitle: { fontSize: 11, fontWeight: 700 },
  obsDetail: { fontSize: 10, color: '#4A4742', marginTop: 2 },
  costRow: {
    padding: 8, backgroundColor: '#FEF6E7',
    borderRadius: 6, marginBottom: 6, fontSize: 10,
  },
  recoCard: {
    padding: 10, borderWidth: 1, borderColor: '#E8E6E1',
    borderRadius: 8, marginBottom: 8, backgroundColor: '#FAFAF7',
  },
  recoChip: {
    fontSize: 7.5, fontWeight: 700, letterSpacing: 0.4,
    color: '#fff', backgroundColor: '#1A1916',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 999, marginRight: 6,
  },
  recoHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  recoWhat: { fontSize: 11, fontWeight: 700 },
  recoLabel: { color: '#A8A49C', fontWeight: 700, fontSize: 9.5 },
  recoLine: { fontSize: 10, color: '#4A4742', marginTop: 2 },
  ctaBox: {
    marginTop: 18, padding: 14,
    backgroundColor: '#1A1916',
    color: '#fff', borderRadius: 8,
    fontSize: 11,
  },
  footer: {
    position: 'absolute',
    bottom: 18, left: 40, right: 40,
    textAlign: 'center',
    color: '#A8A49C',
    fontSize: 8.5,
  },
})

function verdictStyle(v: 'good' | 'neutral' | 'bad') {
  if (v === 'good') return styles.cellValueGood
  if (v === 'bad') return styles.cellValueBad
  return styles.cellValueNeutral
}

export function SnapshotReportPdf({ payload, branding, lead, generatedAt }: SnapshotReportPdfProps) {
  const accentColor = branding.accent || '#1A1916'
  const dynamic = StyleSheet.create({
    logoBox: { ...styles.logoBox, backgroundColor: accentColor },
    obsNum: { ...styles.obsNum, backgroundColor: accentColor },
    recoChip: { ...styles.recoChip, backgroundColor: accentColor },
    ctaBox: { ...styles.ctaBox, backgroundColor: accentColor },
    sectionTitle: { ...styles.sectionTitle, color: accentColor },
  })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          {branding.agencyLogoUrl ? (
            <Image src={branding.agencyLogoUrl} style={styles.logoImg} />
          ) : (
            <View style={dynamic.logoBox}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 700 }}>
                {branding.agencyName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.agencyName}>{branding.agencyName}</Text>
            <Text style={styles.smallMuted}>Snapshot for {lead.name ?? 'a prospect'}</Text>
          </View>
          <Text style={styles.date}>
            {new Date(generatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>

        {/* Headline */}
        <Text style={styles.category}>
          {lead.category ?? 'Local business'}
          {lead.address ? `  ·  ${lead.address}` : ''}
        </Text>
        <Text style={styles.h1}>{lead.name ?? 'Untitled business'}</Text>
        {payload.headline ? <Text style={styles.headline}>{payload.headline}</Text> : null}

        {/* Snapshot grid */}
        {payload.snapshot.length > 0 && (
          <View style={styles.snapshotGrid}>
            {payload.snapshot.map((s, i) => (
              <View key={i} style={styles.snapshotCell}>
                <Text style={styles.cellLabel}>{s.label}</Text>
                <Text style={verdictStyle(s.verdict)}>{s.value}</Text>
                {s.benchmark ? <Text style={styles.cellBenchmark}>{s.benchmark}</Text> : null}
              </View>
            ))}
          </View>
        )}

        {/* Observations */}
        {payload.observations.length > 0 && (
          <>
            <Text style={dynamic.sectionTitle}>What we noticed</Text>
            {payload.observations.map((o, i) => (
              <View key={i} style={styles.obsRow} wrap={false}>
                <Text style={dynamic.obsNum}>{i + 1}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.obsTitle}>{o.title}</Text>
                  <Text style={styles.obsDetail}>{o.detail}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {/* Estimated cost */}
        {payload.estimatedCost.length > 0 && (
          <>
            <Text style={dynamic.sectionTitle}>What it&apos;s likely costing them</Text>
            {payload.estimatedCost.map((c, i) => (
              <View key={i} style={styles.costRow} wrap={false}>
                <Text>
                  <Text style={{ fontWeight: 700 }}>{c.area}:</Text>{' '}
                  <Text style={{ color: '#4A4742' }}>{c.rough_impact}</Text>
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Recommendations */}
        {payload.recommendations.length > 0 && (
          <>
            <Text style={dynamic.sectionTitle}>What we&apos;d do</Text>
            {payload.recommendations.map((r, i) => (
              <View key={i} style={styles.recoCard} wrap={false}>
                <View style={styles.recoHeading}>
                  <Text style={dynamic.recoChip}>{SERVICE_LABELS[r.service] ?? r.service}</Text>
                  <Text style={styles.recoWhat}>{r.what}</Text>
                </View>
                {r.why ? (
                  <Text style={styles.recoLine}>
                    <Text style={styles.recoLabel}>Why: </Text>
                    {r.why}
                  </Text>
                ) : null}
                {r.expectedOutcome ? (
                  <Text style={styles.recoLine}>
                    <Text style={styles.recoLabel}>Outcome: </Text>
                    {r.expectedOutcome}
                  </Text>
                ) : null}
              </View>
            ))}
          </>
        )}

        {/* CTA */}
        {payload.callToAction ? (
          <View style={dynamic.ctaBox} wrap={false}>
            <Text style={{ color: '#fff' }}>{payload.callToAction}</Text>
          </View>
        ) : null}

        {!branding.hideYuzuuBranding && (
          <Text style={styles.footer} fixed>Powered by Yuzuu</Text>
        )}
      </Page>
    </Document>
  )
}
