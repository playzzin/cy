const postcss = require('postcss');
const selectorParser = require('postcss-selector-parser');

// Keep rem-based spacing, data grids and document previews at their original size.
const FIXED_REGIONS = [
  'table', '[role="table"]', '[role="grid"]', '[role="treegrid"]',
  '.handsontable', '.ag-root-wrapper', '[class*="ag-theme-"]',
  '.print-area-wrapper', '.print-only-region', '.payslip-excel-print-sheet',
  '[data-preserve-font-size]',
].join(',');
const GUARD = `:where(:not(html,body,svg,svg *,i,.svg-inline--fa,.svg-inline--fa *,${FIXED_REGIONS},:is(${FIXED_REGIONS}) *,:has(:is(${FIXED_REGIONS}))))`;

function readableSelector(selector) {
  const parsed = selectorParser().astSync(selector);
  parsed.each((branch) => {
    // Generated content commonly contains icon glyphs; placeholders inherit text size.
    let hasPseudoElement = false;
    branch.walkPseudos((pseudo) => {
      if (/^::|^:(before|after|first-letter|first-line)$/.test(pseudo.value)) {
        hasPseudoElement = true;
      }
    });
    if (hasPseudoElement) {
      branch.remove();
    } else {
      branch.append(selectorParser().astSync(GUARD).first.first.clone());
    }
  });
  return parsed.toString();
}

function isFixedLength(value) {
  // Inherited/em/percentage sizes already grow with their parent. Do not add twice.
  return /(?:\d|\.)\s*(?:px|rem|pt)\b/i.test(value)
    && !/(?:\d|\.)\s*(?:em|ex|ch|%)|\bvar\(/i.test(value);
}

module.exports = function readableType() {
  return {
    postcssPlugin: 'cy-readable-type',
    OnceExit(root) {
      const source = root.source?.input?.file || '';
      if (/[\\/]node_modules[\\/]/.test(source)) return;

      // Snapshot first so the screen overrides are never processed a second time.
      const rules = [];
      root.walkRules((rule) => rules.push(rule));
      for (const rule of rules) {
        let skip = false;
        for (let parent = rule.parent; parent; parent = parent.parent) {
          if (parent.type === 'atrule' && (
            /keyframes$/i.test(parent.name)
            || (parent.name === 'media' && /\bprint\b/i.test(parent.params))
          )) skip = true;
        }
        if (skip) continue;

        const declarations = rule.nodes.filter((node) => (
          node.type === 'decl' && node.prop === 'font-size' && isFixedLength(node.value)
        ));
        if (!declarations.length) continue;
        const selector = readableSelector(rule.selector);
        if (!selector) continue;

        const enlarged = rule.clone({ selector, nodes: [] });
        declarations.forEach((declaration) => {
          enlarged.append(declaration.clone({ value: `calc(${declaration.value} + 2px)` }));
        });
        rule.after(postcss.atRule({ name: 'media', params: 'screen' }).append(enlarged));
      }
    },
  };
};
module.exports.postcss = true;
