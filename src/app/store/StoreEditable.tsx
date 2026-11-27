"use client";

import { createContext, useContext, type ElementType, type ReactNode } from "react";

/**
 * A piece of store copy the coach can write on in place.
 *
 * On the storefront there is no provider, and this renders exactly the element
 * it replaced — same tag, same class, nothing added. Inside the store content
 * screen's frame (`/store-preview`, see StorePreviewRoot) the element also
 * carries the field it shows, which is how a click on it is turned into an
 * edit of that field.
 *
 * `tick` is in the key so that every finished edit draws the element afresh:
 * the browser rewrites the text node while the coach types, and React would
 * otherwise go on updating a node that is no longer on the page.
 */
export const StoreEditContext = createContext<{ editing: boolean; tick: number } | null>(null);

export function Editable({
  as: Tag = "span",
  field,
  className,
  children,
}: {
  as?: ElementType;
  field: string;
  className?: string;
  children: ReactNode;
}) {
  const edit = useContext(StoreEditContext);
  if (!edit?.editing) return <Tag className={className}>{children}</Tag>;
  return (
    <Tag key={edit.tick} className={className} data-store-edit={field}>
      {children}
    </Tag>
  );
}
