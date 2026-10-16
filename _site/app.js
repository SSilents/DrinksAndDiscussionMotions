import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ygorhjelejuagliaiaza.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_kcwuUmWcvxR0YNxpyse5XQ_w-FspC0F";
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const motionForm = document.querySelector("#motion-form");
const formStatus = document.querySelector("#form-status");
const motionsList = document.querySelector("#motions-list");
const motionsStatus = document.querySelector("#motions-status");
const refreshButton = document.querySelector("#refresh-motions");

const escapeHtml = (value) => {
  const element = document.createElement("div");
  element.textContent = value ?? "";
  return element.innerHTML;
};

const formatDate = (date) => new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
}).format(new Date(date));

const setStatus = (element, message, isError = false) => {
  element.textContent = message;
  element.classList.toggle("error", isError);
};

async function ensureAnonymousSession() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (session) return session;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

async function loadMotions() {
  setStatus(motionsStatus, "Loading motions...");
  const { data: motions, error } = await supabase
    .from("motions")
    .select("id, title, proposer, supporting_argument, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    setStatus(motionsStatus, `Could not load motions: ${error.message}`, true);
    return;
  }

  if (!motions.length) {
    setStatus(motionsStatus, "No motions yet. Be the first to submit one!");
    motionsList.replaceChildren();
    return;
  }

  const motionIds = motions.map(({ id }) => id);
  const { data: reactions, error: reactionsError } = await supabase
    .from("motion_reactions")
    .select("motion_id, vote")
    .in("motion_id", motionIds);

  if (reactionsError) {
    setStatus(motionsStatus, `Could not load reactions: ${reactionsError.message}`, true);
    return;
  }

  const counts = reactions.reduce((result, reaction) => {
    const current = result[reaction.motion_id] ?? { up: 0, down: 0 };
    current[reaction.vote === 1 ? "up" : "down"] += 1;
    result[reaction.motion_id] = current;
    return result;
  }, {});

  motionsList.innerHTML = motions.map((item) => {
    const count = counts[item.id] ?? { up: 0, down: 0 };
    return `
      <article class="motion-card">
        <h3>${escapeHtml(item.title)}</h3>
        <p class="motion-meta">Proposed by ${escapeHtml(item.proposer)} · ${formatDate(item.created_at)}</p>
        <p class="supporting-argument">${escapeHtml(item.supporting_argument)}</p>
        <div class="reaction-controls" data-motion-id="${item.id}">
          <button class="reaction-button" type="button" data-vote="1" aria-label="Vote for ${escapeHtml(item.title)}">For <span>${count.up}</span></button>
          <button class="reaction-button" type="button" data-vote="-1" aria-label="Vote against ${escapeHtml(item.title)}">Against <span>${count.down}</span></button>
        </div>
      </article>
    `;
  }).join("");
  setStatus(motionsStatus, `${motions.length} motion${motions.length === 1 ? "" : "s"}`);
}

motionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = motionForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  setStatus(formStatus, "Publishing...");

  try {
    const session = await ensureAnonymousSession();
    const formData = new FormData(motionForm);
    const { error } = await supabase.from("motions").insert({
      author_id: session.user.id,
      title: formData.get("title").trim(),
      proposer: formData.get("proposer").trim(),
      supporting_argument: formData.get("supporting_argument").trim(),
    });
    if (error) throw error;
    motionForm.reset();
    setStatus(formStatus, "Motion published.");
    await loadMotions();
  } catch (error) {
    setStatus(formStatus, `Could not publish motion: ${error.message}`, true);
  } finally {
    submitButton.disabled = false;
  }
});

motionsList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-vote]");
  if (!button) return;
  button.disabled = true;

  try {
    const session = await ensureAnonymousSession();
    const motionId = button.closest("[data-motion-id]").dataset.motionId;
    const { error } = await supabase.from("motion_reactions").upsert({
      motion_id: motionId,
      user_id: session.user.id,
      vote: Number(button.dataset.vote),
    }, { onConflict: "motion_id,user_id" });
    if (error) throw error;
    await loadMotions();
  } catch (error) {
    setStatus(motionsStatus, `Could not save reaction: ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
});

refreshButton.addEventListener("click", loadMotions);
loadMotions();
