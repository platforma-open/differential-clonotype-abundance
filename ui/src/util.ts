import type { PColumnPredicate, PTableColumnSpec } from '@platforma-sdk/model';
import { Annotation, Domain, PAxisName, readAnnotationJson, readDomain } from '@platforma-sdk/model';

export const isSequenceColumn: PColumnPredicate = ({ spec }) => {
  // Hard rejections: length and annotation columns aren't sequences.
  if (
    spec.name === 'pl7.app/vdj/sequenceLength'
    || spec.name === 'pl7.app/sequenceLength'
    || spec.name === 'pl7.app/vdj/sequence/annotation'
  ) return false;
  if (readDomain(spec, Domain.Alphabet) !== 'aminoacid') return false;

  // Exclude single-cell non-primary chains (e.g. light). Keep chain-less
  // constructs like scFv where the chain/index domain key is absent entirely.
  if (spec.axesSpec[0]?.name === PAxisName.VDJ.ScClonotypeKey) {
    const chainIndex = readDomain(spec, Domain.VDJ.ScClonotypeChain.Index);
    if (chainIndex !== undefined && chainIndex !== 'primary') return false;
  }

  // Auto-select assembling features (e.g. VDJRegion, scFv construct, peptide
  // sequence). Other aa sequences (CDR3, FR3, etc.) remain available as
  // opt-in choices.
  // TODO: replace direct access with `readAnnotationJson(spec, Annotation.IsAssemblingFeature)` after SDK rename.
  const isAssemblingFeature
    = Boolean(readAnnotationJson(spec, Annotation.VDJ.IsAssemblingFeature)
      ?? spec.annotations?.['pl7.app/isAssemblingFeature'] === 'true');
  return { default: isAssemblingFeature };
};

export function defaultFilters(tSpec: PTableColumnSpec): (unknown | undefined) { // TODO: update type with defaultFilters feature restoring or remove
  // console.log(`defaultFilters spec ${JSON.stringify(tSpec, null, 2)}`);
  if (tSpec.type !== 'column') {
    return undefined;
  }

  const spec = tSpec.spec;

  if (spec.annotations?.['pl7.app/isScore'] !== 'true')
    return undefined;

  const valueString = spec.annotations?.['pl7.app/score/defaultCutoff'];
  if (valueString === undefined)
    return undefined;

  if (spec.valueType === 'String') {
    try {
      const value = JSON.parse(valueString);
      // should be an array of strings
      if (!Array.isArray(value)) {
        console.error('defaultFilters: invalid string filter', valueString);
        return undefined;
      }
      // console.log('defaultFilters: string filter', value);
      return {
        type: 'string_equals',
        reference: value[0], // @TODO: support multiple values
      };
    } catch (e) {
      console.error('defaultFilters: invalid string filter', valueString, e);
      return undefined;
    }
  } else {
    try {
    // Assuming non-String valueType implies a number for 'number_greaterThan'
      const numericValue = parseFloat(valueString);
      if (isNaN(numericValue)) {
        console.error('defaultFilters: invalid numeric value', valueString);
        return undefined;
      }

      const direction = spec.annotations?.['pl7.app/score/rankingOrder'] ?? 'increasing';
      if (direction !== 'increasing' && direction !== 'decreasing') {
        console.error('defaultFilters: invalid ranking order', direction);
        return undefined;
      }

      // console.log('defaultFilters: number filter', numericValue, direction);
      return {
        type: direction === 'increasing' ? 'number_greaterThanOrEqualTo' : 'number_lessThanOrEqualTo',
        reference: numericValue,
      };
    } catch (e) {
      console.error('defaultFilters: invalid numeric value', valueString, e);
      return undefined;
    }
  }
};
