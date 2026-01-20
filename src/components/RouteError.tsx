
import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router-dom";
import { Button } from "./ui/button";

export function RouteError() {
    const error = useRouteError();
    const navigate = useNavigate();

    let title = "Unexpected Error";
    let message = "Something went wrong.";
    let detail: string | null = null;


    if (isRouteErrorResponse(error)) {

        title = `${error.status} ${error.statusText || "Error"}`;
        message = "Sorry, we encountered an issue processing your request.";
        if (error.status === 404) {
            title = "404 Not Found";
            message = "The page you are looking for could not be found.";
        }
        detail = error.data?.message || error.statusText;
    } else if (error instanceof Error) {
        message = error.message;
        detail = error.stack || null;
    } else if (typeof error === 'string') {
        message = error;
    } else {
        message = "An unknown error occurred.";
        try {
            detail = JSON.stringify(error);
        } catch {
            detail = String(error);
        }
    }

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-center animate-fade-in font-sans">
            <div className="mx-auto max-w-lg space-y-8">
                {/* Error Icon/Illustration could go here */}

                <div className="space-y-3">
                    <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
                        {title}
                    </h1>
                    <p className="text-lg text-muted-foreground">
                        {message}
                    </p>
                </div>

                {detail && (
                    <div className="relative rounded-lg bg-muted/50 p-4 text-left text-sm font-mono text-muted-foreground overflow-auto max-h-64 border border-border/50 shadow-sm">
                        <div className="absolute top-2 right-2 text-[10px] uppercase tracking-wider opacity-50">
                            Error Details
                        </div>
                        <pre className="whitespace-pre-wrap break-words">{detail}</pre>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                    <Button
                        onClick={() => window.location.reload()}
                        variant="outline"
                        className="w-full sm:w-auto min-w-[140px]"
                    >
                        Reload Application
                    </Button>
                    <Button
                        onClick={() => navigate("/")}
                        variant="default"
                        className="w-full sm:w-auto min-w-[140px]"
                    >
                        Return Home
                    </Button>
                </div>
            </div>
        </div>
    );
}
