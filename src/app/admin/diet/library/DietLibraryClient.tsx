"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AdminModal from "../../components/AdminModal";
import { deleteDietPlanAction, deleteGeneralDietGroupAction } from "../plan/actions";
import { copyDietPlanToTraineeAction, duplicateDietPlanAction } from "./actions";
import { countItems, fmtMacro, type MealsData } from "@/types/diet";
import type { TraineeOption } from "@/types/admin";
import { arabicCount, CHOICE, ITEM, MEAL } from "@/lib/arabicCount";
import { toast, Toaster } from "react-hot-toast";
import { Icon } from "@/components/Icon";
import { CustomSelect } from "@/components/CustomSelect";
import { formatTimestamp } from "@/lib/trainingDates";
import { normalizeArabic, arabicIncludes } from "@/lib/arabicSearch";
/* The course library's stylesheet, unchanged and unextended. Every class this
   page uses is one of its `co-` rules, which is the point: the two libraries
   are the same screen over different rows, and a second copy of those rules
   would be two things to keep in step. Cross-importing a panel stylesheet is
   how the programme builder already borrows the diet builder's layout. */
import "../../crm.css";
import "../../courses/courses.css";

/** One alternative inside a card — a trainee's slot, or a template's. */
export type LibraryChoice = {
  id: string;
  name: string;
  position: number;
  meals: MealsData;
};

/**
 * One card in the library.
 *
 * For a prescribed plan that is one row. For a general template it is the whole
 * group — both alternatives folded into one card, because the coach authored
 * them together and hands them over together.
 *
 * The three owner fields are empty on a general template, and that is the only
 * thing distinguishing the two kinds, so `ownerId` is what every branch below
 * tests rather than a separate flag that could disagree with it.
 */
export type LibraryPlan = {
  /** The group id for a template, the row id for a prescribed plan. */
  key: string;
  name: string;
  choices: LibraryChoice[];
  created_at: string;
  updated_at: string;
  ownerId: string;
  ownerName: string;
  ownerUsername: string;
  /** Empty for a prescribed plan. */
  groupId: string;
  /** The slot, for a prescribed plan — how its delete addresses the row. */
  position: number;
};

/** Where the builder opens this card — by trainee, or by the template's group. */
const editHref = (plan: LibraryPlan) =>
  plan.ownerId
    ? `/admin/diet/plan?traineeId=${plan.ownerId}`
    : plan.groupId
      ? `/admin/diet/plan?groupId=${plan.groupId}`
      : `/admin/diet/plan`;

const SORTS: [string, string][] = [
  ["newest", "الأحدث"],
  ["oldest", "الأقدم"],
  ["name", "الاسم"],
];

export default function DietLibraryClient({
  initialPlans,
  initialTrainees = [],
}: {
  initialPlans: LibraryPlan[];
  initialTrainees?: TraineeOption[];
}) {
  const router = useRouter();

  /* Only the id is held, never the row: after router.refresh() a held object is
     a stale snapshot, and the dialog would keep showing the plan as it was
     before an edit until it was closed and reopened. Same reason the course
     library keeps `selectedCourseId` rather than the course. */
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showCopyModal, setShowCopyModal] = useState<string | null>(null);
  const [selectedTraineeId, setSelectedTraineeId] = useState<string>("");
  const [isActionLoading, setIsActionLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("newest");

  const plans = initialPlans || [];
  const trainees = initialTrainees || [];

  const planById = (key: string | null) =>
    key ? plans.find((p) => p.key === key) ?? null : null;
  const selectedPlan = planById(selectedPlanId);

  const query = normalizeArabic(searchTerm);
  const filteredPlans = plans
    .filter((plan) => {
      if (!query) return true;
      /* The trainee's name and username are searchable too — on this page the
         owner is half of what identifies a plan, and "أنظمة أحمد" is the
         question a coach actually arrives with. A general plan has no owner to
         match, so it answers to the word printed on its own card instead. */
      return (
        arabicIncludes(plan.name, query) ||
        arabicIncludes(plan.ownerName, query) ||
        arabicIncludes(plan.ownerUsername, query) ||
        (!plan.ownerId && arabicIncludes("نظام عام", query))
      );
    })
    .sort((a, b) => {
      if (activeFilter === "oldest") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (activeFilter === "name") return a.name.localeCompare(b.name, "ar");
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const handleDeletePlan = async () => {
    const plan = planById(showDeleteConfirm);
    if (!plan) return;
    setIsActionLoading(true);
    const toastId = toast.loading("جاري حذف النظام الغذائي...");

    try {
      /* The builder's own delete actions, reused as-is: both are guarded, both
         are a deleteMany so removing something already gone is a no-op rather
         than an error to special-case. Which one applies is the same question
         everywhere on this page — does the plan have an owner. A general plan
         has no (trainee, slot) to be addressed by. */
      const result = plan.ownerId
        ? await deleteDietPlanAction({
            traineeId: plan.ownerId,
            position: plan.position,
          })
        : await deleteGeneralDietGroupAction({ groupId: plan.groupId });
      if (result.success) {
        toast.success("تم حذف النظام الغذائي بنجاح!", { id: toastId });
        setShowDeleteConfirm(null);
        if (selectedPlanId === plan.key) setSelectedPlanId(null);
        router.refresh();
      } else {
        toast.error(result.error || "فشل حذف النظام الغذائي.", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ غير متوقع أثناء الحذف.", { id: toastId });
    } finally {
      setIsActionLoading(false);
    }
  };

  /* Deliberately not behind a confirmation, for the reason the course library
     states about its own duplicate button: it creates something and destroys
     nothing, and the copy is one press of the delete button away. */
  const handleDuplicatePlan = async (plan: LibraryPlan) => {
    setIsActionLoading(true);
    const toastId = toast.loading("جاري نسخ النظام الغذائي...");

    try {
      const result = await duplicateDietPlanAction(
        plan.groupId ? { groupId: plan.groupId } : { planId: plan.key }
      );
      if (result.success) {
        toast.success(
          `تم إنشاء «${result.name}» — نظام عام مستقل يمكن تعديله ونسخه للمشتركين.`,
          { id: toastId, duration: 5000 }
        );
        router.refresh();
      } else {
        toast.error(result.error || "فشل نسخ النظام الغذائي.", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ غير متوقع أثناء النسخ.", { id: toastId });
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCopyPlan = async () => {
    if (!showCopyModal || !selectedTraineeId) return;
    setIsActionLoading(true);
    const toastId = toast.loading("جاري تجهيز نسخة المشترك...");

    try {
      const source = planById(showCopyModal);
      if (!source) return;

      /* A template travels whole — every choice in it — while a prescribed plan
         is the one row. Which of the two is named by whether the card carries a
         group, the same test the rest of this file makes. */
      const result = await copyDietPlanToTraineeAction(
        source.groupId
          ? { groupId: source.groupId, traineeId: selectedTraineeId }
          : { planId: source.key, traineeId: selectedTraineeId }
      );
      if (result.success) {
        toast.success(
          result.choices > 1
            ? `تم نسخ «${result.name}» بخياريه — نسخة مستقلة يملكها المشترك وحده.`
            : `تم إنشاء «${result.name}» — نسخة مستقلة يملكها المشترك وحده.`,
          { id: toastId, duration: 5000 }
        );
        setShowCopyModal(null);
        setSelectedTraineeId("");
        router.refresh();
      } else {
        toast.error(result.error || "فشل نسخ النظام الغذائي.", { id: toastId });
      }
    } catch (error) {
      console.error(error);
      toast.error("حدث خطأ غير متوقع أثناء النسخ.", { id: toastId });
    } finally {
      setIsActionLoading(false);
    }
  };

  const totalPlans = plans.length;
  const copySource = planById(showCopyModal);
  const deleteTarget = planById(showDeleteConfirm);

  return (
    <div className="crm-dashboard">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--admin-bg-2)",
            color: "var(--admin-on-surface)",
            border: "1px solid var(--admin-primary)",
            padding: "16px 24px",
            borderRadius: "4px",
            direction: "rtl",
            fontSize: "0.95rem",
            fontWeight: "600",
          },
        }}
      />

      <div className="crm-split-layout">
        <div className="crm-main-area co-page">
          <header className="co-header">
            <div className="co-header-text">
              <h1>مكتبة الأنظمة الغذائية</h1>
              {/* One count, the one the list itself is about — the course
                  library was cut back to exactly this at the coach's request. */}
              <div className="co-stats">
                <span className="co-stat">
                  <b>{totalPlans}</b> نظام غذائي
                </span>
              </div>
            </div>

            <Link href="/admin/diet/plan" className="co-add-btn">
              <Icon name="add" style={{ fontSize: 20 }} />
              <span>تصميم نظام غذائي</span>
            </Link>
          </header>

          <div className="co-toolbar">
            <div className="co-toolbar-row">
              <div className="co-search">
                <Icon name="search" />
                <input
                  type="text"
                  placeholder="ابحث باسم النظام أو اسم المشترك..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    className="co-search-clear"
                    onClick={() => setSearchTerm("")}
                    aria-label="مسح البحث"
                  >
                    <Icon name="close" style={{ fontSize: 16 }} />
                  </button>
                )}
              </div>

              <div className="co-segment" role="group" aria-label="الترتيب">
                {SORTS.map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setActiveFilter(v)}
                    aria-pressed={activeFilter === v}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <p className="co-count">
            عرض <b>{filteredPlans.length}</b> من {totalPlans} نظاماً غذائياً
          </p>

          <div className="co-grid">
            {filteredPlans.length === 0 ? (
              /* A fruitless search is not the same as an empty library. */
              <div className="co-empty">
                <Icon name={plans.length === 0 ? "nutrition" : "search_off"} />
                <p>
                  {plans.length === 0
                    ? "لا توجد أنظمة غذائية بعد — ابدأ بتصميم نظام لأحد المشتركين"
                    : "لا توجد أنظمة تطابق البحث الحالي"}
                </p>
                {plans.length === 0 ? (
                  <Link href="/admin/diet/plan" className="co-add-btn">
                    <Icon name="add" style={{ fontSize: 20 }} />
                    <span>تصميم نظام غذائي</span>
                  </Link>
                ) : (
                  <button className="co-add-btn" onClick={() => setSearchTerm("")}>
                    <Icon name="filter_alt_off" style={{ fontSize: 20 }} />
                    <span>إزالة التصفية</span>
                  </button>
                )}
              </div>
            ) : (
              filteredPlans.map((plan) => {
                /* The card's numbers describe its first choice. Summing across
                   alternatives would be wrong arithmetic on a real question —
                   the two are what the trainee picks *between*, not two halves
                   of one day's food — so the count of choices is shown instead
                   and the per-choice figures wait for the dialog. */
                const first = plan.choices[0];
                const mealCount = first ? first.meals.length : 0;
                const itemCount = first ? countItems(first.meals) : 0;
                const isSelected = selectedPlanId === plan.key;

                return (
                  <article
                    key={plan.key}
                    className={`co-card ${isSelected ? "selected" : ""}`}
                    onClick={() => setSelectedPlanId(plan.key)}
                  >
                    <div className="co-card-head">
                      <span className="co-card-icon">
                        <Icon name="nutrition" />
                      </span>
                      <div className="co-card-title">
                        <h3>{plan.name}</h3>
                        {/* The owner, not a description — for a prescribed plan
                            it identifies the document rather than sitting
                            beside it the way a course's trainees do. A general
                            plan says so here instead, in the same place, so the
                            two kinds are told apart at a glance. */}
                        <p>{plan.ownerId ? plan.ownerName : "نظام عام — بلا مشترك"}</p>
                      </div>
                    </div>

                    <div className="co-chips">
                      {/* Said first, because it changes what the numbers beside
                          it mean: they belong to the first choice only. */}
                      {plan.choices.length > 1 && (
                        <span className="co-chip co-chip--assigned">
                          {arabicCount(plan.choices.length, CHOICE)}
                        </span>
                      )}
                      {mealCount === 0 ? (
                        <span className="co-chip co-chip--empty">لا توجد وجبات بعد</span>
                      ) : (
                        <>
                          <span className="co-chip co-chip--primary">
                            {arabicCount(mealCount, MEAL)}
                          </span>
                          <span className="co-chip">{arabicCount(itemCount, ITEM)}</span>
                        </>
                      )}
                    </div>

                    <div className="co-card-foot">
                      <span className="co-card-date">
                        <Icon name="calendar_today" />
                        {formatTimestamp(plan.created_at)}
                      </span>

                      {/* Opening the plan is a real control rather than only a
                          click handler on the card, for the reason the course
                          library spells out: the article cannot be given
                          role="button" while these controls live inside it. */}
                      <div className="co-actions">
                        <button
                          className="co-icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPlanId(plan.key);
                          }}
                          title="عرض التفاصيل"
                          aria-label={`عرض تفاصيل ${plan.name}`}
                        >
                          <Icon name="visibility" />
                        </button>
                        <button
                          className="co-icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowCopyModal(plan.key);
                          }}
                          title="نسخ إلى مشترك"
                          aria-label={`نسخ ${plan.name} إلى مشترك`}
                        >
                          <Icon name="person_add" />
                        </button>
                        <button
                          className="co-icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicatePlan(plan);
                          }}
                          disabled={isActionLoading}
                          title={plan.ownerId ? "نسخ كنظام عام" : "نسخ النظام"}
                          aria-label={`إنشاء نسخة عامة من ${plan.name}`}
                        >
                          <Icon name="content_copy" />
                        </button>
                        <Link
                          className="co-icon-btn"
                          href={editHref(plan)}
                          onClick={(e) => e.stopPropagation()}
                          title="تعديل"
                          aria-label={`تعديل ${plan.name}`}
                        >
                          <Icon name="edit" />
                        </Link>
                        <button
                          className="co-icon-btn danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowDeleteConfirm(plan.key);
                          }}
                          title="حذف"
                          aria-label={`حذف ${plan.name}`}
                        >
                          <Icon name="delete" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        {/* The details dialog. Widest of the admin modals for the same reason
            the course library's is: it lays out a whole plan, not one question. */}
        {selectedPlan && (
          <AdminModal
            isOpen={!!selectedPlan}
            onClose={() => setSelectedPlanId(null)}
            title={selectedPlan.name}
            icon="nutrition"
            maxWidth={900}
            footer={
              <div className="admin-modal-foot-row" style={{ direction: "rtl" }}>
                {/* /export-diet is behind requireUserPage + sessionOwnsProfile,
                    and sessionOwnsProfile answers true for an admin — the panel
                    is built on acting for other people. So the coach can open
                    any trainee's sheet from here, exactly as the course library
                    links to /export-workout.

                    A template prints too, addressed by its group instead — the
                    sheet leaves the name, date, weight, height and goal as
                    dashes, exactly as the training sheet does for a course
                    nobody is on. So both kinds of card carry this button, and
                    only the key in the address differs. */}
                {(selectedPlan.ownerId || selectedPlan.groupId) && (
                  <a
                    href={
                      selectedPlan.ownerId
                        ? `/export-diet?profileId=${selectedPlan.ownerId}`
                        : `/export-diet?groupId=${selectedPlan.groupId}`
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="crm-btn-secondary"
                    style={{
                      padding: "10px 18px",
                      fontSize: "0.9rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      textDecoration: "none",
                      cursor: "pointer",
                    }}
                  >
                    <Icon name="file_download" style={{ fontSize: 18 }} />
                    <span>تحميل النظام الغذائي PDF</span>
                  </a>
                )}
                <button
                  onClick={() => {
                    handleDuplicatePlan(selectedPlan);
                    setSelectedPlanId(null);
                  }}
                  disabled={isActionLoading}
                  className="crm-btn-secondary"
                  style={{
                    padding: "10px 18px",
                    fontSize: "0.9rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                  }}
                >
                  <Icon name="content_copy" style={{ fontSize: 18 }} />
                  <span>{selectedPlan.ownerId ? "نسخ كنظام عام" : "نسخ النظام"}</span>
                </button>
                <button
                  onClick={() => {
                    setShowCopyModal(selectedPlan.key);
                    setSelectedPlanId(null);
                  }}
                  disabled={isActionLoading}
                  className="crm-btn-secondary"
                  style={{
                    padding: "10px 18px",
                    fontSize: "0.9rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                  }}
                >
                  <Icon name="person_add" style={{ fontSize: 18 }} />
                  <span>نسخ إلى مشترك</span>
                </button>
                <Link
                  href={editHref(selectedPlan)}
                  className="crm-btn-primary"
                  style={{
                    padding: "10px 18px",
                    fontSize: "0.9rem",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Icon name="edit" style={{ fontSize: 18 }} />
                  <span>تعديل النظام</span>
                </Link>
              </div>
            }
          >
            <div style={{ padding: "24px 28px", direction: "rtl", textAlign: "start" }}>
              <div
                style={{
                  marginBottom: 24,
                  paddingBottom: 20,
                  borderBottom:
                    "1px solid color-mix(in srgb, var(--admin-on-surface) 6%, transparent)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 12px 0",
                    color: "var(--admin-on-surface)",
                    fontSize: "0.95rem",
                    lineHeight: 1.7,
                  }}
                >
                  {selectedPlan.ownerId ? (
                    <>
                      صاحب النظام: <strong>{selectedPlan.ownerName}</strong>
                      {selectedPlan.ownerUsername &&
                      selectedPlan.ownerUsername !== selectedPlan.ownerName
                        ? ` (@${selectedPlan.ownerUsername})`
                        : ""}
                    </>
                  ) : (
                    <>
                      <strong>نظام عام</strong> — لا يخصّ مشتركاً بعينه. انسخه لمن تشاء، ولكل مشترك
                      نسخته الخاصة.
                    </>
                  )}
                </p>
                <p
                  style={{
                    margin: "0 0 14px 0",
                    color: "var(--admin-outline)",
                    fontSize: "0.9rem",
                  }}
                >
                  تم الإنشاء في: {formatTimestamp(selectedPlan.created_at)}
                  {" · "}
                  آخر تعديل: {formatTimestamp(selectedPlan.updated_at)}
                </p>

                {selectedPlan.choices.length > 1 && (
                  <p style={{ margin: "0 0 12px 0", color: "var(--admin-outline)", fontSize: "0.9rem" }}>
                    {arabicCount(selectedPlan.choices.length, CHOICE)} — يختار المشترك بينهما.
                  </p>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
                {selectedPlan.choices.map((choice, cIndex) => (
                  <div key={choice.id}>
                    {/* Headed only when there is something to tell apart. One
                        choice is just "the plan", and a heading over it would
                        be a distinction the coach never drew. */}
                    {selectedPlan.choices.length > 1 && (
                      <h3
                        style={{
                          margin: "0 0 14px 0",
                          fontSize: "1.05rem",
                          fontWeight: 700,
                          color: "var(--admin-on-surface)",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          flexWrap: "wrap",
                        }}
                      >
                        <span>{choice.name || `الخيار ${cIndex + 1}`}</span>
                        <span className="crm-tag primary-tag">
                          {arabicCount(choice.meals.length, MEAL)}
                        </span>
                        <span className="crm-tag">{arabicCount(countItems(choice.meals), ITEM)}</span>
                      </h3>
                    )}

                    {selectedPlan.choices.length === 1 && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                        <span className="crm-tag primary-tag">
                          {arabicCount(choice.meals.length, MEAL)}
                        </span>
                        <span className="crm-tag">{arabicCount(countItems(choice.meals), ITEM)}</span>
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                {choice.meals.length === 0 ? (
                  <div className="crm-empty-state" style={{ padding: "32px 16px" }}>
                    <Icon name="inventory_2" />
                    <p style={{ margin: 0, fontSize: "0.95rem" }}>
                      لا توجد وجبات مضافة في هذا النظام.
                    </p>
                  </div>
                ) : (
                  choice.meals.map((meal, mIndex) => {
                    return (
                      <div
                        key={meal.id || mIndex}
                        className="crm-modal-section"
                        style={{
                          background: "var(--admin-bg-3)",
                          padding: "18px 20px",
                          borderRadius: "8px",
                          border:
                            "1px solid color-mix(in srgb, var(--admin-on-surface) 5%, transparent)",
                        }}
                      >
                        <h4
                          className="crm-modal-section-title"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            margin: "0 0 14px 0",
                            fontSize: "1.05rem",
                            color: "var(--admin-on-surface)",
                            fontWeight: 700,
                          }}
                        >
                          <Icon name="restaurant" style={{ color: "var(--primary)" }} />
                          <span>{meal.name || `الوجبة ${mIndex + 1}`}</span>
                          {meal.time && (
                            <span
                              className="crm-tag"
                              style={{
                                padding: "2px 12px",
                                fontSize: "0.75rem",
                                borderRadius: "20px",
                              }}
                            >
                              {meal.time}
                            </span>
                          )}
                        </h4>

                        {meal.startNote && (
                          <p
                            style={{
                              margin: "-6px 0 12px",
                              color: "var(--admin-outline)",
                              fontSize: "0.85rem",
                              lineHeight: 1.7,
                            }}
                          >
                            {meal.startNote}
                          </p>
                        )}

                        {meal.items.length === 0 ? (
                          <div
                            style={{
                              color: "var(--admin-outline)",
                              fontSize: "0.85rem",
                              padding: "6px 0",
                            }}
                          >
                            لا توجد أصناف في هذه الوجبة.
                          </div>
                        ) : (
                          <div className="co-minimal-table-wrapper">
                            <table className="co-minimal-table">
                              <thead>
                                <tr>
                                  <th style={{ textAlign: "start" }}>الصنف</th>
                                  <th style={{ textAlign: "center", width: "110px" }}>الكمية</th>
                                </tr>
                              </thead>
                              <tbody>
                                {meal.items.map((item, iIndex) => {
                                  return (
                                    <tr key={item.id || iIndex}>
                                      <td style={{ textAlign: "start" }}>
                                        <div className="co-exercise-cell">
                                          <div className="co-exercise-title">
                                            <span className="co-exercise-num">{iIndex + 1}.</span>
                                            <span>{item.name}</span>
                                          </div>
                                        </div>
                                      </td>
                                      {/* Coloured here because `.co-minimal-table td`
                                          declares none, and the inherited value
                                          is the user agent's black — invisible on
                                          this table's near-black ground. The
                                          course library never showed it: every
                                          cell there wraps its text in something
                                          that carries a colour of its own
                                          (`.co-exercise-cell`, `.co-rep-chip`),
                                          and this is the first bare string to sit
                                          in one. Secondary rather than full
                                          strength, so the amount reads as the
                                          quality of the item beside it rather
                                          than competing with its name. */}
                                      <td
                                        style={{
                                          textAlign: "center",
                                          color: "var(--text-secondary)",
                                        }}
                                      >
                                        {item.weight != null && item.weight > 0
                                          ? `${fmtMacro(item.weight)} ${item.unit || "غرام"}`
                                          : "—"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {meal.note && (
                          <p
                            style={{
                              margin: "10px 0 0",
                              color: "var(--admin-outline)",
                              fontSize: "0.85rem",
                              lineHeight: 1.7,
                            }}
                          >
                            {meal.note}
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </AdminModal>
        )}
      </div>

      {/* Copy dialog — kept centred because it asks for a select. */}
      {copySource && (
        <AdminModal
          isOpen={!!copySource}
          onClose={() => {
            setShowCopyModal(null);
            setSelectedTraineeId("");
          }}
          title="نسخ النظام الغذائي إلى مشترك"
          icon="person_add"
          maxWidth={500}
        >
          <div style={{ padding: 24, direction: "rtl", textAlign: "start" }}>
            <p
              style={{
                margin: "0 0 16px 0",
                fontSize: "0.9rem",
                color: "var(--admin-outline)",
                lineHeight: 1.7,
              }}
            >
              النظام: <strong style={{ color: "var(--admin-on-surface)" }}>{copySource.name}</strong>
              <br />
              {copySource.ownerId ? `صاحبه حالياً: ${copySource.ownerName}` : "نظام عام — بلا مشترك"}
            </p>
            <label
              style={{
                display: "block",
                fontSize: "0.95rem",
                color: "var(--admin-on-surface)",
                marginBottom: 12,
                fontWeight: 500,
              }}
            >
              اختر المشترك الذي ترغب في نسخ النظام له:
            </label>
            {/* Said here because it is the difference between "I edited Ahmad's
                diet" and "I edited everyone's" — the same warning the course
                library gives, and it weighs more here: what a trainee may eat
                is decided by their own allergies and injuries. */}
            <p
              style={{
                margin: "0 0 12px 0",
                fontSize: "0.82rem",
                color: "var(--admin-outline)",
                lineHeight: 1.7,
              }}
            >
              سيحصل المشترك على{" "}
              <strong style={{ color: "var(--admin-on-surface)" }}>نسخة خاصة به</strong>، فأي تعديل
              عليها لاحقاً يخصّه وحده ولا يمسّ النظام الأصلي ولا صاحبه. واختيار صاحب النظام نفسه يضع
              النسخة في خانته الفارغة.
            </p>
            <div style={{ marginBottom: 24 }}>
              {/* The one list in the panel as long as the subscriber roll, and
                  the coach is looking for one person in it by name. */}
              <CustomSelect
                searchable
                searchPlaceholder="ابحث باسم المشترك..."
                value={selectedTraineeId}
                onChange={setSelectedTraineeId}
                placeholder="-- اختر مشترك --"
                options={[
                  { value: "", label: "-- اختر مشترك --" },
                  ...trainees.map((t) => ({
                    value: t.id,
                    label: `${t.name}${
                      t.username && t.username !== t.name ? ` (@${t.username})` : ""
                    }`,
                  })),
                ]}
              />
            </div>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  setShowCopyModal(null);
                  setSelectedTraineeId("");
                }}
                disabled={isActionLoading}
                className="crm-btn-secondary"
              >
                إلغاء
              </button>
              <button
                onClick={handleCopyPlan}
                disabled={isActionLoading || !selectedTraineeId}
                className="crm-btn-primary"
                style={{ opacity: isActionLoading || !selectedTraineeId ? 0.6 : 1 }}
              >
                {isActionLoading ? "جاري النسخ..." : "نسخ النظام"}
              </button>
            </div>
          </div>
        </AdminModal>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <AdminModal
          isOpen={!!deleteTarget}
          onClose={() => setShowDeleteConfirm(null)}
          title="تأكيد الحذف"
          icon="delete"
          maxWidth={400}
        >
          <div style={{ padding: 24, textAlign: "center", direction: "rtl" }}>
            <p
              style={{
                margin: "0 0 16px 0",
                color: "var(--admin-on-surface)",
                fontSize: "1rem",
                lineHeight: 1.6,
              }}
            >
              هل أنت متأكد من رغبتك في حذف <strong>«{deleteTarget.name}»</strong>؟
            </p>
            {/* Name the person who loses it — and say plainly when nobody does.
                A general plan is not prescribed to anyone, and warning that a
                trainee will lose their diet when none will is the kind of
                sentence that makes every other warning easier to ignore. */}
            {deleteTarget.ownerId ? (
              <p
                style={{
                  margin: "0 0 16px 0",
                  padding: "12px",
                  borderRadius: 4,
                  background: "color-mix(in srgb, var(--error) 10%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--error) 30%, transparent)",
                  color: "var(--admin-on-surface)",
                  fontSize: "0.88rem",
                  lineHeight: 1.7,
                }}
              >
                هذا النظام يخصّ <strong>{deleteTarget.ownerName}</strong> — وسيفقده عند الحذف.
              </p>
            ) : (
              <p
                style={{
                  margin: "0 0 16px 0",
                  color: "var(--admin-outline)",
                  fontSize: "0.88rem",
                  lineHeight: 1.7,
                }}
              >
                نظام عام لا يخصّ أحداً — والنسخ التي أُخذت منه لمشتركين تبقى كما هي.
                {deleteTarget.choices.length > 1 &&
                  ` وسيُحذف بخياريه معاً (${deleteTarget.choices.length}).`}
              </p>
            )}
            <p style={{ margin: "0 0 24px 0", color: "var(--error-text)", fontSize: "0.85rem" }}>
              لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                disabled={isActionLoading}
                className="crm-btn-secondary"
                style={{ flex: 1 }}
              >
                تراجع
              </button>
              <button
                onClick={handleDeletePlan}
                disabled={isActionLoading}
                className="crm-btn-primary"
                style={{ flex: 1, background: "var(--error)", color: "var(--text-inverse)" }}
              >
                {isActionLoading ? "جاري الحذف..." : "نعم، احذف"}
              </button>
            </div>
          </div>
        </AdminModal>
      )}
    </div>
  );
}
