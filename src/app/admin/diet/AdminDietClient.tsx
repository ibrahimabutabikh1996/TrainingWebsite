"use client";

import Link from "next/link";

import { useState } from "react";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";
import type { NutritionSource } from "@/types/admin";
import { getCategoryBadge } from "@/types/diet";
import NutritionFormModal from "./NutritionFormModal";
import { addNutritionSource, updateNutritionSource, deleteNutritionSource } from "./actions";
import { Icon } from "@/components/Icon";
import "./diet.css";

const CATEGORIES = ["مصادر البروتين", "مصادر الكاربوهيدرات", "مصادر الدهون الصحية", "الخضراوات", "الفواكه"];

const normalizeCat = (c?: string) => {
  if (c === "مصادر الخضراوات") return "الخضراوات";
  if (c === "مصادر الفواكه") return "الفواكه";
  return c || "";
};

export default function AdminDietClient({ initialSources }: { initialSources: NutritionSource[] }) {
  const [sources, setSources] = useState<NutritionSource[]>(() =>
    initialSources.map((s) => ({ ...s, category: normalizeCat(s.category) }))
  );
  const [selectedCategory, setSelectedCategory] = useState<string>("مصادر البروتين");
  const [query, setQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<NutritionSource | null>(null);
  const [modalKey, setModalKey] = useState(0);

  const openAddModal = () => {
    setEditingSource(null);
    setModalKey((k) => k + 1);
    setIsModalOpen(true);
  };

  const openEditModal = (source: NutritionSource) => {
    setEditingSource(source);
    setModalKey((k) => k + 1);
    setIsModalOpen(true);
  };

  const handleSave = async (data: Omit<NutritionSource, "id" | "created_at">, id?: string) => {
    if (id) {
      const res = await updateNutritionSource(id, data);
      if (res.success) {
        setSources((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...data } : s))
        );
        toast.success("تم التعديل بنجاح");
      } else {
        toast.error("فشل التعديل");
        throw new Error("Update failed");
      }
    } else {
      const res = await addNutritionSource(data);
      if (res.success && res.id) {
        setSources((prev) => [
          { ...data, id: res.id!, created_at: new Date() },
          ...prev,
        ]);
        toast.success("تمت الإضافة بنجاح");
      } else {
        toast.error("فشل الإضافة");
        throw new Error("Add failed");
      }
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف "${name}"؟`)) return;
    
    const res = await deleteNutritionSource(id);
    if (res.success) {
      setSources((prev) => prev.filter((s) => s.id !== id));
      toast.success("تم الحذف");
    } else {
      toast.error("فشل الحذف");
    }
  };
  const inCategory = sources.filter((s) => normalizeCat(s.category) === selectedCategory);
  const q = query.trim().toLowerCase();
  const filteredSources = q
    ? inCategory.filter((s) => s.name.toLowerCase().includes(q))
    : inCategory;

  return (
    <div className="diet-page">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--bg2)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            direction: "rtl",
            fontFamily: "inherit",
            fontWeight: 600,
          },
        }}
      />

      <header className="diet-header">
        <div className="diet-header-text">
          <h1>النظام الغذائي</h1>
          <p>إدارة مصادر التغذية لتوفير خيارات صحية للمشتركين عند تصميم الأنظمة الغذائية.</p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <Link href="/admin/diet/plan" className="diet-btn-secondary">
            <Icon name="edit_document" style={{ fontSize: 20 }} />
            <span>إنشاء نظام غذائي</span>
          </Link>
          <button onClick={openAddModal} className="diet-add-btn">
            <Icon name="add" style={{ fontSize: 20 }} />
            <span>إضافة مصدر غذائي</span>
          </button>
        </div>
      </header>

      <div className="diet-toolbar">
        <div className="diet-segment" role="group" aria-label="تصنيف المصدر">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setSelectedCategory(c)}
              aria-pressed={selectedCategory === c}
            >
              {c}
              <span className="diet-segment-count">
                {sources.filter((s) => normalizeCat(s.category) === c).length}
              </span>
            </button>
          ))}
        </div>

        <div className="diet-search">
          <Icon name="search" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث عن مصدر في هذا التصنيف..."
            aria-label="بحث"
          />
          {query && (
            <button
              type="button"
              className="diet-search-clear"
              onClick={() => setQuery("")}
              title="مسح البحث"
              aria-label="مسح البحث"
            >
              <Icon name="close" />
            </button>
          )}
        </div>
      </div>

      <div className="diet-grid">
        {filteredSources.length === 0 ? (
          q ? (
            <div className="diet-empty">
              <Icon name="search_off" />
              <p>لا توجد مصادر مطابقة لـ «{query}» في هذا التصنيف.</p>
              <button onClick={() => setQuery("")} className="diet-add-btn" style={{ marginTop: 8 }}>
                <Icon name="close" style={{ fontSize: 20 }} />
                <span>مسح البحث</span>
              </button>
            </div>
          ) : (
            <div className="diet-empty">
              <Icon name="restaurant_menu" />
              <p>لا توجد مصادر غذائية مضافة في هذا التصنيف بعد.</p>
              <button onClick={openAddModal} className="diet-add-btn" style={{ marginTop: 8 }}>
                <Icon name="add" style={{ fontSize: 20 }} />
                <span>إضافة مصدر جديد</span>
              </button>
            </div>
          )
        ) : (
          filteredSources.map((source) => {
            const badge = getCategoryBadge(source.category);
            return (
              <article key={source.id} className="diet-card-minimal">
                <div className="diet-card-minimal-icon">
                  <img src={badge.image} alt={source.name} />
                </div>

                <div className="diet-card-minimal-text">
                  <h3>{source.name}</h3>
                  <p>{source.notes || badge.label}</p>
                </div>

                <div className="diet-card-minimal-actions">
                  <button
                    className="minimal-action-btn edit-btn"
                    onClick={() => openEditModal(source)}
                    title="تعديل العنصر"
                  >
                    <Icon name="edit" />
                  </button>
                  <button
                    className="minimal-action-btn delete-btn"
                    onClick={() => handleDelete(source.id, source.name)}
                    title="حذف العنصر"
                  >
                    <Icon name="delete" />
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      <NutritionFormModal
        key={modalKey}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingSource={editingSource}
        onSave={handleSave}
      />
    </div>
  );
}
