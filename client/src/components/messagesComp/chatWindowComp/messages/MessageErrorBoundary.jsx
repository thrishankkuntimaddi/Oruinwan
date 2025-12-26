import React from 'react';

class MessageErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Message rendering error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="px-4 py-2 my-1 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">
                        ⚠️ Failed to render message
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="text-xs text-red-500 hover:text-red-700 underline mt-1"
                    >
                        Try again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default MessageErrorBoundary;
