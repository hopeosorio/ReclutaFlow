interface Step {
  id: string;
  label: string;
  helper?: string;
}

interface StepperProps {
  steps: Step[];
  current: number;
}

export default function Stepper({ steps, current }: StepperProps) {
  return (
    <div className="stepper">
      {steps.map((step, index) => (
        <div
          key={step.id}
          className={`stepper-item ${index === current ? "active" : index < current ? "done" : ""}`}
        >
          <div className="stepper-dot" />
          <div>
            <strong>{step.label}</strong>
            {step.helper ? <span>{step.helper}</span> : null}
          </div>
        </div>
      ))}
    </div>
  );
}
