import {
  AttributeAppliesTo,
  AttributeUsage,
  SubCategoryAttribute,
} from './entities/subcategoria-attribute.entity';

export function getDefaultUsageForAppliesTo(appliesTo: AttributeAppliesTo) {
  return appliesTo === AttributeAppliesTo.VARIANT
    ? AttributeUsage.VARIANT_ATTRIBUTE
    : AttributeUsage.PRODUCT_ATTRIBUTE;
}

export function normalizeSubCategoryAttributeAppliesTo<T extends SubCategoryAttribute>(
  attribute: T,
): T {
  if (!attribute.appliesTo) {
    attribute.appliesTo = attribute.appliesToVariant
      ? AttributeAppliesTo.VARIANT
      : AttributeAppliesTo.PRODUCT;
  }

  attribute.appliesToVariant = attribute.appliesTo === AttributeAppliesTo.VARIANT;
  attribute.usage ??= getDefaultUsageForAppliesTo(attribute.appliesTo);

  return attribute;
}

export function normalizeSubCategoryAttributesAppliesTo<
  T extends SubCategoryAttribute,
>(attributes?: T[]): T[] {
  return (attributes ?? []).map(attribute =>
    normalizeSubCategoryAttributeAppliesTo(attribute),
  );
}
