import React from 'react';
import { Info } from 'lucide-react';

export const InfoPanel: React.FC = () => {
  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
      <div className="flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900">
          <p className="font-semibold mb-2">How Causal Mediation Works:</p>
          <ol className="space-y-2 list-decimal list-inside">
            <li>
              <strong>Residual Stream:</strong> The colored "water" shows how information flows
              through transformer layers. Brighter = stronger activations.
            </li>
            <li>
              <strong>Logit Lens:</strong> At each layer, we can peek at the top predicted tokens
              by projecting the residual stream to vocabulary space.
            </li>
            <li>
              <strong>Intervention:</strong> Drag a logit lens cell from the <strong>source prompt</strong> and
              drop it onto a layer in the <strong>original prompt</strong> to replace that layer's activations.
            </li>
            <li>
              <strong>Result:</strong> Watch how the intervention causes the model's predictions
              to change! The water colors blend to show the mixed activations.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
};
