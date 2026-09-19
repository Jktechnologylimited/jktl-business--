"use server";

import * as db from "@/lib/db/testimonials";
import { requireSession } from "@/lib/session";
import type { ActionResult } from "./types";
import type { Testimonial } from "@/lib/types";

export async function createTestimonialAction(id: string, input: db.TestimonialInput): Promise<ActionResult<Testimonial>> {
  try {
    const { organizationId } = await requireSession();
    return { ok: true, data: await db.createTestimonial(organizationId, id, input) };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't save this testimonial." };
  }
}

export async function updateTestimonialAction(id: string, input: db.TestimonialInput): Promise<ActionResult<Testimonial>> {
  try {
    const { organizationId } = await requireSession();
    const testimonial = await db.updateTestimonial(organizationId, id, input);
    if (!testimonial) return { ok: false, error: "Testimonial not found." };
    return { ok: true, data: testimonial };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't update this testimonial." };
  }
}

export async function deleteTestimonialAction(id: string): Promise<ActionResult<null>> {
  try {
    const { organizationId } = await requireSession();
    await db.deleteTestimonial(organizationId, id);
    return { ok: true, data: null };
  } catch (err) {
    console.error(err);
    return { ok: false, error: "Couldn't delete this testimonial." };
  }
}
