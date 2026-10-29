import { describe, expect, it } from "vitest";
import { toFormValues, toRequestBody } from "./ProfileForm";

describe("profile form values", () => {
  it("starts blank without a profile", () => {
    expect(toFormValues(null)).toEqual({
      age: "",
      sex: "",
      feet: "",
      inches: "",
      weightLb: "",
      activityLevel: "",
      minIngredients: "",
      maxIngredients: "",
      maxMealCost: "",
      weeklyBudget: "",
    });
  });

  it("shows height as feet and inches", () => {
    const values = toFormValues({
      age: 25,
      sex: "male",
      heightIn: 70,
      weightLb: 160.5,
      activityLevel: "light",
      minIngredients: 3,
      maxIngredients: null,
      maxMealCost: 4,
      weeklyBudget: null,
    });
    expect(values).toEqual({
      age: "25",
      sex: "male",
      feet: "5",
      inches: "10",
      weightLb: "160.5",
      activityLevel: "light",
      minIngredients: "3",
      maxIngredients: "",
      maxMealCost: "4",
      weeklyBudget: "",
    });
  });

  it("rounds inches to one decimal", () => {
    expect(
      toFormValues({
        age: 25,
        sex: "male",
        heightIn: 69.99999,
        weightLb: 160,
        activityLevel: "light",
        minIngredients: null,
        maxIngredients: null,
        maxMealCost: null,
        weeklyBudget: null,
      }).inches,
    ).toBe("10");
  });

  it("builds the request body in inches", () => {
    expect(
      toRequestBody({
        age: "25",
        sex: "female",
        feet: "5",
        inches: "4.5",
        weightLb: "130",
        activityLevel: "active",
        minIngredients: "3",
        maxIngredients: " ",
        maxMealCost: "$5",
        weeklyBudget: "",
      }),
    ).toEqual({
      age: 25,
      sex: "female",
      heightIn: 64.5,
      weightLb: 130,
      activityLevel: "active",
      minIngredients: 3,
      maxIngredients: null,
      maxMealCost: 5,
      weeklyBudget: null,
    });
  });

  it("treats blank inches as zero and other blanks as missing", () => {
    const body = toRequestBody({
      age: "",
      sex: "",
      feet: "6",
      inches: "",
      weightLb: " ",
      activityLevel: "",
      minIngredients: "",
      maxIngredients: "",
      maxMealCost: "",
      weeklyBudget: "",
    });
    expect(body.heightIn).toBe(72);
    expect(body.age).toBeNaN();
    expect(body.weightLb).toBeNaN();
  });
});
