// Ilustraciones SVG de cada tipo de producto. Usan los colores definidos en css/estilos.css:
//  .f = color principal · .s = sombra · .l = luz · .ln = línea de costura · .m = madera · .o = ojitos

const bandana = `
  <path class="f" d="M40 60 Q100 92 160 60 Q152 108 106 156 Q100 162 94 156 Q48 108 40 60Z"/>
  <path class="s" d="M40 60 Q100 92 160 60 Q156 70 152 76 Q100 102 48 76 Q44 70 40 60Z"/>
  <circle class="l" cx="150" cy="70" r="5"/>
  <g class="l" opacity=".75">
    <circle cx="80" cy="102" r="3.5"/><circle cx="100" cy="112" r="3.5"/><circle cx="120" cy="102" r="3.5"/>
    <circle cx="90" cy="126" r="3.5"/><circle cx="110" cy="126" r="3.5"/><circle cx="100" cy="142" r="3.5"/>
  </g>
  <path class="ln" d="M52 82 Q100 106 148 82"/>`;

const DIBUJOS = {
  body: `
    <path class="f" d="M72 40 Q100 60 128 40 L160 58 Q167 63 162 71 L148 93 L138 87 L138 140 Q138 158 121 164 L112 176 L88 176 L79 164 Q62 158 62 140 L62 87 L52 93 L38 71 Q33 63 40 58Z"/>
    <path class="s" d="M72 40 Q100 60 128 40 L134 44 Q100 72 66 44Z"/>
    <path class="ln" d="M66 88 L66 140 Q66 154 82 160 M134 88 L134 140 Q134 154 118 160"/>
    <g class="s"><circle cx="92" cy="170" r="3"/><circle cx="100" cy="170" r="3"/><circle cx="108" cy="170" r="3"/></g>
    <g class="l">
      <path d="M100 92 L84 82 Q78 80 78 88 L78 96 Q78 104 84 102Z"/>
      <path d="M100 92 L116 82 Q122 80 122 88 L122 96 Q122 104 116 102Z"/>
      <circle cx="100" cy="92" r="6"/>
    </g>`,

  gorro: `
    <circle class="f" cx="60" cy="72" r="20"/><circle class="l" cx="60" cy="72" r="10" opacity=".8"/>
    <circle class="f" cx="140" cy="72" r="20"/><circle class="l" cx="140" cy="72" r="10" opacity=".8"/>
    <path class="f" d="M48 132 Q46 56 100 56 Q154 56 152 132Z"/>
    <path class="ln" d="M70 128 Q70 76 100 70 M130 128 Q130 76 100 70"/>
    <rect class="s" x="42" y="122" width="116" height="30" rx="15"/>
    <g class="l" opacity=".6">
      <rect x="56" y="128" width="4" height="18" rx="2"/><rect x="72" y="128" width="4" height="18" rx="2"/>
      <rect x="88" y="128" width="4" height="18" rx="2"/><rect x="104" y="128" width="4" height="18" rx="2"/>
      <rect x="120" y="128" width="4" height="18" rx="2"/><rect x="136" y="128" width="4" height="18" rx="2"/>
    </g>`,

  manta: `
    <rect class="s" x="46" y="128" width="112" height="34" rx="14"/>
    <rect class="f" x="40" y="62" width="120" height="84" rx="16"/>
    <path class="s" d="M160 106 L160 130 Q160 146 144 146 L120 146Z" opacity=".7"/>
    <g class="l" opacity=".7">
      ${[0, 1, 2, 3, 4].map((r) => [0, 1, 2, 3, 4, 5].map((c) => `<circle cx="${58 + c * 17 + (r % 2) * 8}" cy="${78 + r * 14}" r="2.6"/>`).join('')).join('')}
    </g>
    <rect class="ln" x="48" y="70" width="104" height="68" rx="10" fill="none"/>
    <path class="l" d="M118 40 a10 10 0 0 1 18 -4 a12 12 0 0 1 20 8 a8 8 0 0 1 -2 16 h-34 a10 10 0 0 1 -2 -20Z" opacity=".9"/>`,

  babero: bandana,

  sonajero: `
    <circle class="m" cx="82" cy="122" r="36" fill="none" stroke-width="14"/>
    <path class="ln" d="M60 96 Q82 84 104 96" />
    <path class="f" d="M128 42 L138 66 L164 68 L144 84 L151 110 L128 96 L105 110 L112 84 L92 68 L118 66Z"/>
    <path class="s" d="M128 96 L105 110 L112 84Z" opacity=".6"/>
    <circle class="o" cx="121" cy="78" r="3"/><circle class="o" cx="135" cy="78" r="3"/>
    <path class="ln" d="M122 88 Q128 93 134 88"/>
    <rect class="s" x="104" y="96" width="14" height="18" rx="6" transform="rotate(-40 111 105)"/>`,

  escarpines: `
    <g transform="translate(-4 4)">
      <path class="s" d="M40 126 Q40 98 64 96 L64 72 Q64 62 76 62 L96 62 Q106 62 106 72 L106 112 Q130 114 132 134 Q132 148 116 148 L56 148 Q40 148 40 132Z"/>
    </g>
    <g transform="translate(46 22)">
      <path class="f" d="M40 126 Q40 98 64 96 L64 72 Q64 62 76 62 L96 62 Q106 62 106 72 L106 112 Q130 114 132 134 Q132 148 116 148 L56 148 Q40 148 40 132Z"/>
      <rect class="s" x="60" y="60" width="50" height="18" rx="9"/>
      <path class="ln" d="M48 136 Q90 142 126 136"/>
      <path class="l" d="M86 92 l-14 -8 q-5 -2 -5 4 v8 q0 6 5 4Z M86 92 l14 -8 q5 -2 5 4 v8 q0 6 -5 4Z"/>
      <circle class="l" cx="86" cy="92" r="4.5"/>
    </g>`,

  apego: `
    <path class="f" d="M100 70 Q122 92 160 104 Q150 124 162 146 Q128 150 100 178 Q72 150 38 146 Q50 124 40 104 Q78 92 100 70Z"/>
    <path class="ln" d="M100 84 Q118 102 146 112 Q140 126 148 140 Q124 144 100 164 Q76 144 52 140 Q60 126 54 112 Q82 102 100 84Z"/>
    <ellipse class="f" cx="86" cy="44" rx="10" ry="26" transform="rotate(-12 86 44)"/>
    <ellipse class="f" cx="114" cy="44" rx="10" ry="26" transform="rotate(12 114 44)"/>
    <ellipse class="l" cx="86" cy="46" rx="4.5" ry="17" transform="rotate(-12 86 46)" opacity=".85"/>
    <ellipse class="l" cx="114" cy="46" rx="4.5" ry="17" transform="rotate(12 114 46)" opacity=".85"/>
    <circle class="f" cx="100" cy="88" r="28"/>
    <circle class="s" cx="100" cy="88" r="28" opacity=".25"/>
    <path class="o" d="M86 84 q4 4 8 0" fill="none" stroke-width="2.6"/>
    <path class="o" d="M106 84 q4 4 8 0" fill="none" stroke-width="2.6"/>
    <circle class="l" cx="82" cy="96" r="5" opacity=".9"/><circle class="l" cx="118" cy="96" r="5" opacity=".9"/>
    <path class="o" d="M97 96 l3 3 l3 -3" fill="none" stroke-width="2.2"/>
    <path class="s" d="M86 116 l14 -6 l14 6 l-14 6Z"/>`,

  set: `
    <path class="l" d="M60 92 Q40 60 70 62 Q90 66 100 88 Q110 66 130 62 Q160 60 140 92Z" opacity=".95"/>
    <rect class="f" x="46" y="98" width="108" height="70" rx="8"/>
    <rect class="s" x="38" y="84" width="124" height="24" rx="8"/>
    <rect class="l" x="92" y="84" width="16" height="84"/>
    <path class="s" d="M100 88 Q80 58 66 66 Q56 76 72 84Z M100 88 Q120 58 134 66 Q144 76 128 84Z"/>
    <circle class="s" cx="100" cy="86" r="8"/>
    <path class="ln" d="M54 160 L146 160"/>
    <rect class="l" x="112" y="122" width="30" height="20" rx="3" transform="rotate(-6 127 132)" opacity=".9"/>
    <path class="ln" d="M117 130 h18 M117 136 h12" transform="rotate(-6 127 132)"/>`,

  baberos: `
    <g transform="translate(-6 34) scale(.62)" style="--f:var(--salvia);--s:var(--salvia-osc)">${bandana}</g>
    <g transform="translate(82 34) scale(.62)" style="--f:var(--celeste);--s:var(--celeste-osc)">${bandana}</g>
    <g transform="translate(38 70) scale(.68)" style="--f:var(--rosa);--s:var(--rosa-osc)">${bandana}</g>`,
};

export function ilustracion(tipo, color = 'rosa') {
  const dibujo = DIBUJOS[tipo] || DIBUJOS.manta;
  return `<svg class="ilu" viewBox="0 0 200 200" aria-hidden="true" style="--f:var(--${color});--s:var(--${color}-osc)">${dibujo}</svg>`;
}
