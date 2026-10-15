import { describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import CurrencyInput from "@/components/ui/CurrencyInput.vue";
import { centsToInput, digitsToCents } from "@/lib/format-input";

describe("campo de moeda em centavos", () => {
  it("interpreta os dígitos como centavos", () => {
    expect(digitsToCents("1010")).toBe(1010);
    expect(digitsToCents("1")).toBe(1);
    expect(digitsToCents("")).toBeNull();
    expect(digitsToCents("abc")).toBeNull();
    expect(digitsToCents("10,10")).toBe(1010);
    expect(digitsToCents("1.234,56")).toBe(123456);
    expect(digitsToCents("0,01")).toBe(1);
  });

  it("formata centavos para o texto do input", () => {
    expect(centsToInput(1010)).toBe("10,10");
    expect(centsToInput(1)).toBe("0,01");
    expect(centsToInput(null)).toBe("");
  });

  it("digitar 1010 emite 1010 e mostra 10,10", async () => {
    const wrapper = mount(CurrencyInput, { props: { modelValue: null } });
    const input = wrapper.find("input");
    await input.setValue("1010");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([1010]);
    await wrapper.setProps({ modelValue: 1010 });
    expect((input.element as HTMLInputElement).value).toBe("10,10");
  });

  it("ignora separadores digitados", async () => {
    const wrapper = mount(CurrencyInput, { props: { modelValue: null } });
    await wrapper.find("input").setValue("1.000,00");
    expect(wrapper.emitted("update:modelValue")?.at(-1)).toEqual([100000]);
  });
});
