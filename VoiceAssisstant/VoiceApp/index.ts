import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";
import { VoiceAppComponent } from "./VoiceApp";

export class VoiceApp implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _root: Root;
    private _props = {
        functionAppUrl: ""
    };

    public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
        this._root = createRoot(container);
    }

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        // Get the URL from the component's properties
        this._props.functionAppUrl = context.parameters.functionAppUrl.raw || "";

        this._root.render(
            React.createElement(VoiceAppComponent, this._props)
        );
    }
    
    public destroy(): void {
        this._root.unmount();
    }
}