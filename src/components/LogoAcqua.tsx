// Logo Acqua Bistrô em vetor (desenhada a partir da arte enviada pelo dono em 15/10/2026).
// "Acqua" em traço geométrico fino, talher cruzado dourado e "Bistrô" manuscrito com a taça no lugar do "i".
// A fonte do "Bistrô" (Waterfall, Google Fonts) é carregada no index.html. Trocar pelo arquivo vetorial original quando chegar.

const AZUL = '#3B5778'
const DOURADO = '#D6992B'
const VINHO = '#6E1129'

export default function LogoAcqua({ className, titulo = 'Acqua Bistrô' }: { className?: string; titulo?: string }) {
  return (
    <svg viewBox="140 95 1450 750" className={className} role="img" aria-label={titulo}>
      <title>{titulo}</title>

      {/* Acqua */}
      <g fill="none" stroke={AZUL} strokeWidth={9} strokeLinecap="butt" strokeLinejoin="miter">
        {/* A */}
        <path d="M160 505 L297 205 L435 505" />
        <path d="M204 415 H390" />
        {/* c (abertura à direita) */}
        <path d="M684 336 A116 116 0 1 0 684 456" />
        {/* q */}
        <circle cx="845" cy="396" r="116" />
        <path d="M962 284 V615" />
        {/* u */}
        <path d="M1040 284 V402 A98 104 0 0 0 1236 402" />
        <path d="M1236 284 V505" />
        {/* a */}
        <circle cx="1424" cy="396" r="118" />
        <path d="M1548 284 V505" />
        {/* barras sobre as letras */}
        <path d="M388 228 H882" />
        <path d="M1185 228 H1557" />
      </g>

      {/* Talher cruzado */}
      <g stroke={DOURADO} strokeLinecap="round" fill="none">
        {/* faca */}
        <path d="M985 150 L1068 231" strokeWidth={10} />
        <path d="M957 119 C968 122 990 140 1012 172 L1003 180 C982 162 962 140 957 119 Z" fill={DOURADO} strokeWidth={3} />
        {/* garfo */}
        <path d="M1050 158 L963 230" strokeWidth={10} />
        <path d="M1046 162 C1052 150 1060 142 1068 138" strokeWidth={8} />
        <path d="M1050 142 L1066 124 M1058 150 L1074 132 M1066 158 L1082 140" strokeWidth={5} />
      </g>

      {/* Bistrô */}
      <g fill={DOURADO} fontFamily="Waterfall, 'Great Vibes', cursive">
        <text x="1226" y="792" fontSize="420" textAnchor="end">B</text>
        <text x="1314" y="776" fontSize="280">strô</text>
      </g>
      {/* traço longo do "t" saindo da taça */}
      <path d="M1312 598 C1400 596 1480 594 1546 594" stroke={DOURADO} strokeWidth={5} strokeLinecap="round" fill="none" />

      {/* Taça no lugar do "i" */}
      <g stroke={DOURADO} strokeWidth={6} strokeLinecap="round" fill="none">
        <path d="M1236 622 C1256 610 1284 628 1304 612 C1303 646 1291 668 1270 670 C1249 668 1237 648 1236 622 Z" fill={VINHO} stroke="none" />
        <path d="M1229 576 H1311" />
        <path d="M1231 576 C1226 636 1242 670 1270 674 C1298 670 1314 636 1309 576" />
        <path d="M1270 674 V746" />
        <path d="M1240 748 H1300" />
      </g>
    </svg>
  )
}
