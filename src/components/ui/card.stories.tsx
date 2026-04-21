import type { Meta, StoryObj } from "@storybook/react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const meta: Meta<typeof Card> = {
  title: "UI/Card",
  component: Card,
};
export default meta;

type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Engagement</CardTitle>
        <CardDescription>Acme Modernization</CardDescription>
      </CardHeader>
      <CardContent>3 discoveries · 5 reviews pending</CardContent>
    </Card>
  ),
};
