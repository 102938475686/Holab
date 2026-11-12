import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Lawyer } from '@/lib/lawyers'

// 센터 위치 지도. 지도 타일은 OpenStreetMap에서 불러오고, 내 위치는 이 브라우저 안에서만 표시합니다(서버로 보내지 않음).
export interface MapCenter extends Lawyer { rank: number }

const pin = (n: number, selected: boolean) =>
  L.divIcon({
    className: '',
    html: `<span class="holab-pin${selected ? ' sel' : ''}">${n}</span>`,
    iconSize: [34, 34], iconAnchor: [17, 17], popupAnchor: [0, -18],
  })

export default function CenterMap({
  centers, selected, onSelect, me, className,
}: { centers: MapCenter[]; selected: string | null; onSelect: (name: string) => void; me: { lat: number; lon: number } | null; className?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const layer = useRef<L.LayerGroup | null>(null)
  const markers = useRef<Map<string, L.Marker>>(new Map())
  const fitted = useRef('')

  useEffect(() => {
    if (!host.current || map.current) return
    const m = L.map(host.current, { scrollWheelZoom: false, zoomControl: true }).setView([37.5665, 126.978], 11)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> 기여자',
    }).addTo(m)
    layer.current = L.layerGroup().addTo(m)
    map.current = m
    // 카드 안에서 처음 그려질 때 크기를 못 잡는 경우가 있어 한 번 다시 계산
    setTimeout(() => m.invalidateSize(), 150)
    const ro = new ResizeObserver(() => m.invalidateSize())
    ro.observe(host.current)
    return () => { ro.disconnect(); m.remove(); map.current = null; layer.current = null; markers.current.clear() }
  }, [])

  // 마커 갱신 (순위·선택 상태가 바뀔 때)
  useEffect(() => {
    const m = map.current, g = layer.current
    if (!m || !g) return
    g.clearLayers(); markers.current.clear()
    for (const c of centers) {
      const mk = L.marker([c.lat, c.lon], { icon: pin(c.rank, c.name === selected), title: `${c.rank}. ${c.name}`, keyboard: true, riseOnHover: true })
        .bindPopup(`<b>${c.name}</b><br/>${c.address}<br/>${c.phone}`)
        .on('click', () => onSelect(c.name))
      mk.addTo(g); markers.current.set(c.name, mk)
    }
    if (me) {
      L.circleMarker([me.lat, me.lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).bindTooltip('내 위치(또는 고른 구)').addTo(g)
    }
    // 목록 구성이 바뀌었을 때만 화면을 맞춤 (선택만 바뀌면 화면은 그대로)
    const sig = centers.map((c) => c.name).join('|') + (me ? `|${me.lat},${me.lon}` : '')
    if (fitted.current !== sig) {
      fitted.current = sig
      const pts: L.LatLngTuple[] = centers.slice(0, me ? 5 : centers.length).map((c) => [c.lat, c.lon])
      if (me) pts.push([me.lat, me.lon])
      if (pts.length) m.fitBounds(L.latLngBounds(pts), { padding: [28, 28], maxZoom: 14 })
    }
  }, [centers, selected, me]) // eslint-disable-line react-hooks/exhaustive-deps

  // 선택한 센터로 부드럽게 이동하고 말풍선 표시
  useEffect(() => {
    const m = map.current
    if (!m || !selected) return
    const c = centers.find((x) => x.name === selected)
    const mk = markers.current.get(selected)
    if (c && mk) { m.flyTo([c.lat, c.lon], Math.max(m.getZoom(), 14), { duration: 0.6 }); mk.openPopup() }
  }, [selected]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={host} role="region" aria-label="센터 위치 지도" className={className ?? 'h-80 w-full overflow-hidden rounded-xl border'} />
}
